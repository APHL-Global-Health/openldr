import "dotenv/config";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { logger } from "./lib/logger";
import { formatUptime } from "./lib/utils";
import * as mapper from "./events/mapper";
import * as storage from "./events/storage";
import * as validation from "./events/validation";

import dataProcessingRouter from "./controllers/data.processing.controller";

const IsDev = process.env.NODE_ENV === "development";

const app = express();

// Trust proxy
app.set("trust proxy", 1);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP request logging
if (IsDev) {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }),
  );
}

app.use("/api/v1", dataProcessingRouter);

// Health check
app.get("/health", (_req: Request, res: Response) => {
  const uptimeSeconds = process.uptime();

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: formatUptime(uptimeSeconds),
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Data Processing API",
    version: "1.2.0",
    health: "/health",
    endpoints: {
      api: "/api/v1",
    },
  });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ error: err.message, stack: err.stack }, "Unhandled error");
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

const port = process.env.DATA_PROCESSING_PORT || 1001;
app.listen(port, () => {
  validation.start();
  mapper.start();
  storage.start();

  logger.info(
    {
      port: port,
      nodeVersion: process.version,
    },
    `Server started`,
  );
});
