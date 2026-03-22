/**
 * CORS middleware configuration
 * Uses the cors npm package with origin from config
 */

const corsPackage = require('cors');
const config = require('../config');

const corsMiddleware = corsPackage({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
});

module.exports = corsMiddleware;
