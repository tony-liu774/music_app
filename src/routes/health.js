const express = require('express');
const config = require('../config');

const router = express.Router();

// Basic health check endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Detailed health check endpoint
router.get('/detailed', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

module.exports = router;
