const express = require('express');

const router = express.Router();

const jobMatchingController = require('./jobMatching.controller');

router.get('/health', jobMatchingController.healthCheck);

router.post('/predict', jobMatchingController.predict)

module.exports = router;