const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const logger = require('./middleware/logger');
const cors = require('./middleware/cors');
const rateLimiter = require('./middleware/rateLimiter');
const healthRoutes = require('./routes/health');

const app = express();

// Security headers
app.use(helmet());

// Request logging
app.use(logger);

// CORS configuration
app.use(cors);

// Rate limiting
app.use(rateLimiter);

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check routes
app.use('/health', healthRoutes);

// API routes (placeholder for future routes)
app.use('/api', (req, res) => {
  res.status(200).json({
    message: 'Music App API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      healthDetailed: '/health/detailed',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: config.nodeEnv === 'production' ? 'Internal Server Error' : err.message,
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
  });
});

// Start server
const server = app.listen(config.port, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
