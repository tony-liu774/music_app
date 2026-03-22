/**
 * Rate limiting middleware
 * Uses express-rate-limit with config from ../config
 * Skips rate limiting in test environment
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = rateLimiter;
