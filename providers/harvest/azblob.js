// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const utils = require('../../lib/utils');
const azure = require('azure-storage');
const moment = require('moment');

// Responsible for storing and retrieving harvested data
//
// Return format should be:
//
// {
// toolA: { /* tool-specific data format },
// toolB/2.0: { /* tool-specific data format }
// }

const resultOrError = (resolve, reject) => (error, result, response) => error ? reject(error) : resolve(result);
const responseOrError = (resolve, reject) => (error, result, response) => error ? reject(error) : resolve(response);

class AzBlobHarvesterService {
  constructor(options, summarizerService) {
    this.options = options;
    this.containerName = options.containerName;
    this.summarizerService = summarizerService;
  }

  get blobService() {
    const blobService = azure.createBlobService(this.options.connectionString).withFilter(new azure.LinearRetryPolicyFilter());
    Object.defineProperty(this, 'blobService', { value: blobService, writable: false, configurable: true });
    this.blobService.createContainerIfNotExists(this.containerName, () => { });
    return this.blobService;
  }

  list(packageCoordinates) {
    const name = utils.toPathFromCoordinates(packageCoordinates);
    return new Promise((resolve, reject) => {
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject));
    }).then(result =>
      result.entries.map(entry => {
        return {
          name: entry.name.substr(entry.name.lastIndexOf('/') + 1),
          lastModified: moment(entry.lastModified).format(),
          etag: entry.etag
        };
      }));
  }

  get(packageCoordinates, stream) {
    const name = utils.toPathFromCoordinates(packageCoordinates);
    if (stream)
      return new Promise((resolve, reject) => {
        this.blobService.getBlobToStream(this.containerName, name, stream, responseOrError(resolve, reject));
      });
    return new Promise((resolve, reject) => {
      this.blobService.getBlobToText(this.containerName, name, resultOrError(resolve, reject));
    }).then(result =>
      JSON.parse(result));
  }

  getAll(packageCoordinates) {
    const name = utils.toPathFromCoordinates(packageCoordinates);
    // Note that here we are assuming the number of blobs will be small-ish (<10) and 
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    const list = new Promise((resolve, reject) => {
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject));
    });
    const contents = list.then(files => {
      return Promise.all(files.entries.map(file => {
        return new Promise((resolve, reject) => {
          this.blobService.getBlobToText(this.containerName, file.name, resultOrError(resolve, reject));
        }).then(result => {
          return { name: file.name, content: JSON.parse(result) };
        });
      }));
    });
    return contents.then(entries => {
      return entries.reduce((result, entry) => {
        const segments = entry.name.split('/');
        const tool = segments[segments.length - 2];
        const toolVersion = segments[segments.length - 1].replace('.json', '');
        const current = result[tool] = result[tool] || {};
        current[toolVersion] = entry.content;
        return result;
      }, {});
    });
  }

  store(packageCoordinates, stream) {
    return new Promise((resolve, reject) => {
      const name = utils.toPathFromCoordinates(packageCoordinates);
      stream.pipe(this.blobService.createWriteStreamToBlockBlob(this.containerName, name, responseOrError(resolve, reject)));
    });
  }
}

module.exports = (config, summarizerService) => new AzBlobHarvesterService(config, summarizerService);