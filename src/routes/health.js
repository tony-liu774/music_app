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

// Detailed health check endpoint - only available in development
router.get('/detailed', (req, res) => {
  const response = {
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  };

  // Only expose system details in development mode
  if (config.nodeEnv === 'development') {
    response.uptime = process.uptime();
    response.memory = process.memoryUsage();
  }

  res.status(200).json(response);
});

module.exports = router;
