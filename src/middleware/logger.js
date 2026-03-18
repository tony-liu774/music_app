const morgan = require('morgan');
const config = require('../config');

// Create custom token for response time
morgan.token('response-time', (req, res) => {
  return res.getHeader('X-Response-Time');
});

// Custom format string
const customFormat = ':method :url :status :res[content-length] - :response-time ms';

const logger = morgan(customFormat, {
  skip: (req, res) => {
    // Skip logging in test environment
    return config.nodeEnv === 'test';
  },
  stream: process.stdout,
});

module.exports = logger;
