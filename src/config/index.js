require('dotenv').config();

// Parse CORS origins from comma-separated string
const parseCorsOrigins = (originsStr) => {
  if (!originsStr) return 'http://localhost:5173';
  const origins = originsStr.split(',').map(o => o.trim());
  return origins.length === 1 ? origins[0] : origins;
};

const nodeEnv = process.env.NODE_ENV || 'development';

// JWT secret: required in production, fallback only for dev/test
const jwtSecret = process.env.JWT_SECRET || (nodeEnv === 'production' ? null : 'music-app-jwt-secret-dev');
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required in production');
}

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
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  app: {
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
  },
};
