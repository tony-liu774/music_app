require('dotenv').config();

// Parse CORS origins from comma-separated string
const parseCorsOrigins = (originsStr) => {
  if (!originsStr) return 'http://localhost:5173';
  const origins = originsStr.split(',').map(o => o.trim());
  return origins.length === 1 ? origins[0] : origins;
};

const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv,
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  app: {
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
  },
};
