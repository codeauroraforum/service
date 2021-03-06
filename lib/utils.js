// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const semver = require('semver');

function toPackageCoordinates(request) {
  return {
    type: request.params.type,
    provider: request.params.provider,
    namespace: request.params.namespace === '-' ? null : request.params.namespace,
    name: request.params.name,
    revision: request.params.revision,
    tool: request.params.tool,
    toolVersion: request.params.toolVersion
  };
}

function toPathFromCoordinates(packageCoordinates) {
  const c = packageCoordinates;
  const revisionPart = c.revision ? `revision/${c.revision}` : null;
  const toolVersionPart = c.toolVersion ? c.toolVersion : null;
  const toolPart = c.tool ? `tool/${c.tool}` : null;
  return [c.type, c.provider, c.namespace || '-', c.name, revisionPart, toolPart, toolVersionPart].filter(s => s).join('/');
}

module.exports = {
  toPackageCoordinates,
  toPathFromCoordinates
};
