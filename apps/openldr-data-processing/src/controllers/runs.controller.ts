import { Router } from "express";
import * as messageTrackingService from "../services/message.tracking.service";
import * as minioService from "../services/minio.service";
import * as dlqReplay from "../services/dlq-replay.service";
import { logger } from "../lib/logger";

const router = Router();

// GET / — List runs (paginated, filtered, sorted)
router.get("/", async (req, res) => {
  try {
    const result = await messageTrackingService.listRuns({
      page: parseInt(req.query.page as string) || 0,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
      sortBy: (req.query.sortBy as string) || "createdAt",
      sortDir: (req.query.sortDir as "asc" | "desc") || "desc",
      status: req.query.status as string | undefined,
      projectId: req.query.projectId as string | undefined,
      dataFeedId: req.query.dataFeedId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    });
    return res.json(result);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, "Error listing runs");
    return res.status(500).json({ error: "Failed to list runs" });
  }
});

// GET /:messageId — Run detail with events + file hash
router.get("/:messageId", async (req, res) => {
  try {
    const detail = await messageTrackingService.getRunDetail(req.params.messageId);
    if (!detail) {
      return res.status(404).json({ error: "Run not found" });
    }
    return res.json(detail);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, "Error getting run detail");
    return res.status(500).json({ error: "Failed to get run detail" });
  }
});

// POST /:messageId/retry — Replay failed run from DLQ
router.post("/:messageId/retry", async (req, res) => {
  try {
    const result = await dlqReplay.replayFromDlq(req.params.messageId);
    return res.json(result);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, "Error retrying run");
    const status = error.message.includes("not found") ? 404
      : error.message.includes("not in failed") ? 400
      : error.message.includes("no longer exists") ? 410
      : 500;
    return res.status(status).json({ error: error.message });
  }
});

// DELETE /:messageId — Soft-delete run + remove MinIO objects
router.delete("/:messageId", async (req, res) => {
  try {
    const run = await messageTrackingService.getRunByMessageId(req.params.messageId);
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }

    // Remove MinIO objects
    const cleanupResult = await minioService.deleteRunObjects({
      raw: run.rawObjectPath,
      validated: run.validatedObjectPath,
      mapped: run.mappedObjectPath,
      processed: run.processedObjectPath,
    });

    // Soft delete
    await messageTrackingService.softDeleteRun(req.params.messageId);

    return res.json({
      messageId: req.params.messageId,
      status: "deleted",
      ...cleanupResult,
    });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, "Error deleting run");
    return res.status(500).json({ error: "Failed to delete run" });
  }
});

// DELETE /objects — Purge objects by bucket + prefix
router.delete("/objects/purge", async (req, res) => {
  try {
    const bucket = req.query.bucket as string;
    const prefix = req.query.prefix as string;

    if (!bucket || !prefix) {
      return res.status(400).json({ error: "Both 'bucket' and 'prefix' query params are required" });
    }

    const exists = await minioService.bucketExists(bucket);
    if (!exists) {
      return res.status(404).json({ error: `Bucket '${bucket}' not found` });
    }

    const result = await minioService.purgeObjectsByPrefix(bucket, prefix);
    return res.json(result);
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, "Error purging objects");
    return res.status(500).json({ error: "Failed to purge objects" });
  }
});

export default router;
