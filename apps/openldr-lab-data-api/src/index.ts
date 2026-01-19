import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import * as healthController from "./controllers/healthController";
import * as requestsController from "./controllers/requestsController";
import * as resultsController from "./controllers/resultsController";
import * as patientController from "./controllers/patientsController";
import * as queryController from "./controllers/queryController";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.API_PORT || 8080;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
//   origin: process.env.API_CORS_ORIGINS ? process.env.API_CORS_ORIGINS.split(',') : ['http://localhost:3000'],
//   credentials: true,
//   optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const rateLimitValue = process.env.API_RATE_LIMIT !== undefined ? 
    parseInt(process.env.API_RATE_LIMIT, 10) : 0;
if (rateLimitValue > 0) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: rateLimitValue, // limit each IP to X requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      status_code: 429
    }
  });
  app.use(limiter);
}

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Controllers
app.use('/api/health', healthController.router);
app.use('/api/requests', requestsController.router);
app.use('/api/results', resultsController.router);
app.use('/api/patients', patientController.router);
app.use('/api/query', queryController.router);
// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'OpenLDR Lab Data API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      requests: '/api/requests',
      results: '/api/results',
      patients: '/api/patients',
      query: '/api/query'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    status_code: 404,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`OpenLDR Lab Data API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});