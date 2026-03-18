const morgan = require('morgan');
const config = require('../config');

// Use Morgan's built-in format with response time
const logger = morgan('combined', {
  skip: (req, res) => {
    // Skip logging in test environment
    return config.nodeEnv === 'test';
  },
  stream: process.stdout,
});

module.exports = logger;
