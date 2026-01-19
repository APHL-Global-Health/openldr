import express from "express";
import { healthCheck } from '../services/database';

const router = express.Router();

// GET /api/health
router.get('/', async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        api: {
          status: 'healthy',
          uptime: process.uptime()
        },
        database: dbHealth
      }
    };

    // Determine overall status
    const overallStatus = dbHealth.status === 'healthy' ? 200 : 503;
    
    res.status(overallStatus).json(healthStatus);
  } catch (error:any) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        api: {
          status: 'healthy',
          uptime: process.uptime()
        },
        database: {
          status: 'unhealthy',
          error: error.message
        }
      }
    });
  }
});

export { router };
