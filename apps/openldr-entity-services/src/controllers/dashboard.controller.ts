import { Router, type Request, type Response } from "express";
import {
  getFullDashboard,
  getLabDashboard,
  getInfraDashboard,
} from "../services/dashboard.service";
import { createLogger } from "../lib/logger";

const router = Router();
const logger = createLogger("dashboard-controller");

// ============================================================
// Shared filter parser
// ============================================================

function parseFilters(query: Request["query"]) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return {
    startDateTime:
      (query.startDateTime as string) || startOfDay.toISOString(),
    endDateTime: (query.endDateTime as string) || now.toISOString(),
    facilityCode: (query.facilityCode as string) || undefined,
    projectId: (query.projectId as string) || undefined,
    useCaseId: (query.useCaseId as string) || undefined,
  };
}

// ============================================================
// GET /api/v1/dashboard
// Full aggregated dashboard — single request replaces 11 parallel calls.
// This is the PRIMARY endpoint the frontend should use.
// ============================================================

router.get("/", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const filters = parseFilters(req.query);

    logger.info(
      { filters, path: "/" },
      "Dashboard request: full"
    );

    const data = await getFullDashboard(filters);

    logger.info(
      { durationMs: Date.now() - start },
      "Dashboard response: full"
    );

    return res.json(data);
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack, durationMs: Date.now() - start },
      "Dashboard error: full"
    );
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to load dashboard data",
    });
  }
});

// ============================================================
// GET /api/v1/dashboard/laboratory
// Lab-only data (KPI, charts, facility, results) — lighter payload.
// Use when the user is on the "Laboratory" tab.
// ============================================================

router.get("/laboratory", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const filters = parseFilters(req.query);

    logger.info(
      { filters, path: "/laboratory" },
      "Dashboard request: laboratory"
    );

    const data = await getLabDashboard(filters);

    logger.info(
      { durationMs: Date.now() - start },
      "Dashboard response: laboratory"
    );

    return res.json(data);
  } catch (error: any) {
    logger.error(
      { error: error.message, durationMs: Date.now() - start },
      "Dashboard error: laboratory"
    );
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to load lab dashboard data",
    });
  }
});

// ============================================================
// GET /api/v1/dashboard/infrastructure
// Infrastructure-only data (pipeline, services, storage, databases).
// Use when the user is on the "Infrastructure" tab.
// ============================================================

router.get("/infrastructure", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const filters = parseFilters(req.query);

    logger.info(
      { filters, path: "/infrastructure" },
      "Dashboard request: infrastructure"
    );

    const data = await getInfraDashboard(filters);

    logger.info(
      { durationMs: Date.now() - start },
      "Dashboard response: infrastructure"
    );

    return res.json(data);
  } catch (error: any) {
    logger.error(
      { error: error.message, durationMs: Date.now() - start },
      "Dashboard error: infrastructure"
    );
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to load infrastructure dashboard data",
    });
  }
});

export default router;
