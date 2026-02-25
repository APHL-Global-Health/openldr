import "dotenv/config";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import morgan from "morgan";
// import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger";
// import { formatUptime } from "./lib/utils";
import { pool } from "./lib/db";
import { ensureBucket } from "./lib/storage";

import {
  helmetMiddleware,
  corsMiddleware,
  generalRateLimit,
  requestLogger,
} from "./middleware/security";

import userRouter from "./controllers/user.controller";
import storageRouter from "./controllers/storage.controller";
import terminologyRouter from "./controllers/terminology.controller";
import pluginRouter from "./controllers/plugin.controller";
import opensearchRouter from "./controllers/opensearch.controller";
import formRouter from "./controllers/form.controller";
import archiveRouter from "./controllers/archive.controller";
import extensionRouter from "./controllers/extension.controller";
import dashboardRouter from "./controllers/dashboard.controller";
import queryEngineRouter from "./controllers/query.engine.controller";

const IsDev = process.env.NODE_ENV === "development";

const app = express();

// Trust proxy
app.set("trust proxy", 1);

// Middleware
app.use(requestLogger);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(generalRateLimit);

// app.use(helmet());
// app.use(compression());
// app.use(cors());
// app.use(cors({
//   origin: config.cors.origin,
//   credentials: config.cors.credentials,
// }));

// Rate limiting
// const limiter = rateLimit({
//   windowMs: config.rateLimit.windowMs,
//   max: config.rateLimit.maxRequests,
//   message: "Too many requests from this IP, please try again later.",
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use("/api/", limiter);

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

app.use("/api/v1/users", userRouter);
app.use("/api/v1/storage", storageRouter);
app.use("/api/v1/terminology", terminologyRouter);
app.use("/api/v1/plugin", pluginRouter);
app.use("/api/v1/opensearch", opensearchRouter);
app.use("/api/v1/forms", formRouter);
app.use("/api/v1/archives", archiveRouter);
app.use("/api/v1/extensions", extensionRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/query/engine", queryEngineRouter);

// Health check
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      uptime: process.uptime(),
      db: "connected",
      version: "2.0.0",
    });
  } catch {
    res.status(503).json({ status: "degraded", db: "disconnected" });
  }
});

// const generator = await generateDoc(modelManager);
app.get("/api-doc/:format", async (req, res) => {
  const { format } = req.params;
  // const doc = format === "yaml" ? generator.toYAML() : generator.toJSON();

  if (format === "yaml") {
    const doc: string = ``;
    return res.status(200).type("yaml").send(doc);
  } else {
    const doc: any = {};
    return res.status(200).json(JSON.parse(doc));
  }
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Entity Services API",
    version: "1.2.0",
    health: "/health",
    endpoints: {
      users: "/api/v1/users",
      forms: "/api/v1/forms",
      plugin: "/api/v1/plugin",
      storage: "/api/v1/storage",
      extensions: "/api/v1/extensions",
      opensearch: "/api/v1/opensearch",
      terminology: "/api/v1/terminology",
      dashboard: "/api/v1/dashboard",
      queryEngine: "/api/v1/query/engine",
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

const port = process.env.ENTITY_SERVICES_PORT || 1002;

async function bootstrap(): Promise<void> {
  try {
    await ensureBucket();
    // await seedExtensions();
  } catch (err) {
    console.error("[Bootstrap] Fatal error during startup:", err);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`\nListening on  \x1b[32mhttp://localhost:${port}\x1b[0m`);
    // console.log(
    //   `CORS origins:  \x1b[33m${CONFIG.allowedOrigins.join(", ")}\x1b[0m`,
    // );
    // console.log(
    //   `API key auth:  \x1b[33m${CONFIG.apiKey ? "ENABLED" : "DISABLED (dev mode)"}\x1b[0m`,
    // );
    // console.log(
    //   `Database:      \x1b[33m${process.env.DATABASE_URL || "postgresql://localhost:5432/openldr"}\x1b[0m`,
    // );
    console.log(
      `MinIO:         \x1b[33m${process.env.MINIO_ENDPOINT || "localhost"}:${process.env.MINIO_PORT || 9000}\x1b[0m\n`,
    );
  });
}

bootstrap();
