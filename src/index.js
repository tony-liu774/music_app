const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const config = require('./config');
const logger = require('./middleware/logger');
const cors = require('./middleware/cors');
const rateLimiter = require('./middleware/rateLimiter');
const healthRoutes = require('./routes/health');
const imslpRoutes = require('./routes/imslp');
const omrRoutes = require('./routes/omr');
const teacherRoutes = require('./routes/teacher');
// Auth routes - disabled for public mode
// const authRoutes = require('./routes/auth');
// const oauthRoutes = require('./routes/oauth');
const syncRoutes = require('./routes/sync');
const assignmentRoutes = require('./routes/assignments');
const notificationRoutes = require('./routes/notifications');
const licenseRoutes = require('./routes/license');
const aiRoutes = require('./routes/ai');
const scheduler = require('./services/scheduler');

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
      scriptSrc: ["'self'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
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

// Parse JSON bodies with size limit (larger for sync payloads)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files (frontend) - root directory for PWA
app.use(express.static(path.join(__dirname, '..'), { index: 'index.html' }));
// Serve index.html at root URL
app.get('/', (req, res, next) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).json({ error: 'Failed to load frontend' });
    }
  });
});

// Health check routes
app.use('/health', healthRoutes);

// IMSLP proxy routes
app.use('/api/imslp', imslpRoutes);

// OMR (Optical Music Recognition) routes
app.use('/api/omr', upload.single('image'), omrRoutes);

// Teacher (Studio Dashboard) routes
app.use('/api/teacher', teacherRoutes);

// Authentication routes - disabled for public mode
// app.use('/api/auth', authRoutes);
// app.use('/api/auth/oauth', oauthRoutes);

// Cloud sync routes
app.use('/api/sync', syncRoutes);

// Assignments routes (Smart Assignments & Routine Builder)
app.use('/api/assignments', assignmentRoutes);

// Push notifications routes
app.use('/api/notifications', notificationRoutes);

// License and subscription routes
app.use('/api/licenses', licenseRoutes);

// AI summary routes
app.use('/api', aiRoutes);

// API routes (placeholder for future routes)
app.use('/api', (req, res) => {
  res.status(200).json({
    message: 'Music App API',
    version: '1.0.0',
    publicMode: true,
    endpoints: {
      health: '/health',
      healthDetailed: '/health/detailed',
      imslpSearch: '/api/imslp/search',
      imslpDownload: '/api/imslp/download/:id',
      teacherStudents: '/api/teacher/students',
      teacherMetrics: '/api/teacher/metrics',
      // Auth routes disabled for public mode
      sync: '/api/sync',
      syncStatus: '/api/sync/status',
      assignments: '/api/assignments',
      assignmentProgress: '/api/assignments/:id/progress',
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

// Start server only when run directly (not when imported by tests)
if (require.main === module) {
  // Start the scheduler for background jobs
  scheduler.start();

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
}

module.exports = app;
