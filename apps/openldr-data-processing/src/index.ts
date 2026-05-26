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
import * as outpost from "./events/outpost";

import dataProcessingRouter from "./controllers/data.processing.controller";
import projectsController from "./controllers/projects.controller";
import runsController from "./controllers/runs.controller";

const IsDev = process.env.NODE_ENV === "development";
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (IsDev) app.use(morgan("dev"));
else
  app.use(
    morgan("combined", {
      stream: { write: (message: string) => logger.info(message.trim()) },
    }),
  );

app.use("/api/v1/processor", dataProcessingRouter);
app.use("/api/v1/projects", projectsController);
app.use("/api/v1/runs", runsController);

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: formatUptime(process.uptime()),
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Data Processing API",
    version: "1.3.0",
    health: "/health",
    endpoints: { api: "/api/v1" },
  });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ error: err.message, stack: err.stack }, "Unhandled error");
  res.status(500).json({ success: false, error: "Internal server error" });
});

const port = process.env.DATA_PROCESSING_PORT || 1001;
app.listen(port, () => {
  validation.start();
  mapper.start();
  storage.start();
  outpost.start();
  logger.info({ port, nodeVersion: process.version }, "Server started");
});
