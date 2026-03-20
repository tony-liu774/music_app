const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const config = require('./config');
const logger = require('./middleware/logger');
const cors = require('./middleware/cors');
const rateLimiter = require('./middleware/rateLimiter');
const healthRoutes = require('./routes/health');
const imslpRoutes = require('./routes/imslp');
const omrRoutes = require('./routes/omr');

const app = express();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// Security headers with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // Required for AudioWorklet
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'blob:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'blob:', 'mediastream:'],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", 'blob:'],
    },
  },
}));

// Request logging
app.use(logger);

// CORS configuration
app.use(cors);

// Rate limiting
app.use(rateLimiter);

// Parse JSON bodies with size limit
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Serve static files (frontend) - root directory for PWA
app.use(express.static('.', { index: 'index.html' }));

// Health check routes
app.use('/health', healthRoutes);

// IMSLP proxy routes
app.use('/api/imslp', imslpRoutes);

// OMR (Optical Music Recognition) routes
app.use('/api/omr', upload.single('image'), omrRoutes);

// API routes (placeholder for future routes)
app.use('/api', (req, res) => {
  res.status(200).json({
    message: 'Music App API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      healthDetailed: '/health/detailed',
      imslpSearch: '/api/imslp/search',
      imslpDownload: '/api/imslp/download/:id',
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
app.use((err, req, res, _next) => {
  console.error('Error:', err);
  const status = err.status || 500;
  const response = {
    error: config.nodeEnv === 'production' ? 'Internal Server Error' : err.message,
  };
  if (config.nodeEnv !== 'production') {
    response.stack = err.stack;
  }
  res.status(status).json(response);
});

// Start server
const server = app.listen(config.port, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});

// Handle port binding errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Please try a different port.`);
    process.exit(1);
  }
  throw err;
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
