/**
 * Request logging middleware
 * Logs method, URL, status code, and response duration
 * Skips logging in test environment to reduce noise
 */

const logger = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
};

module.exports = logger;
