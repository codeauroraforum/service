// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();

router.get('/', function (req, res, next) {
  res.status(200).send({ status: 'OK' });
});

module.exports = router;
