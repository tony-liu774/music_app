/**
 * Health check routes
 */

const express = require('express');
const config = require('../config');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/detailed', (req, res) => {
  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  if (config.nodeEnv !== 'production') {
    response.uptime = process.uptime();
    response.memory = process.memoryUsage();
  }
  res.status(200).json(response);
});

module.exports = router;
