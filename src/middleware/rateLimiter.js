/**
 * Rate limiting middleware
 * Uses express-rate-limit with config from ../config
 * Skips rate limiting in test environment
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

const skipInTest = () => process.env.NODE_ENV === 'test';

const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfter = resetTime
      ? Math.ceil((resetTime.getTime() - Date.now()) / 1000)
      : Math.ceil(config.rateLimit.windowMs / 1000);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter,
    });
  },
});

rateLimiter._skipInTest = skipInTest;

module.exports = rateLimiter;
