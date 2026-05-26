import { pool } from "../lib/db";
import { logger } from "../lib/logger";

/**
 * Strip multi-record suffixes (e.g. "__0", "__27983") from messageIds so the
 * base UUID is used for tracking lookups. Multi-record plugins append __N to
 * create unique MinIO filenames, but the tracking DB stores a single UUID per
 * uploaded message.
 */
function toBaseMessageId(messageId: string): string {
  return messageId.replace(/__\d+$/, "");
}

export type PipelineStage =
  | "ingest"
  | "validation"
  | "mapping"
  | "storage"
  | "outpost";

export type PipelineStatus = "queued" | "processing" | "completed" | "failed";

export type StartRunParams = {
  messageId: string;
  projectId: string;
  dataFeedId?: string | null;
  userId?: string | null;
  rawObjectPath?: string | null;
  metadata?: Record<string, any> | null;
};

export type StageEventParams = {
  messageId: string;
  stage: PipelineStage;
  status: PipelineStatus;
  eventType: string;
  topic?: string | null;
  objectPath?: string | null;
  pluginName?: string | null;
  pluginVersion?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  errorDetails?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
};

export type StageFailureParams = {
  messageId: string;
  stage: PipelineStage;
  errorCode?: string | null;
  errorMessage: string;
  errorDetails?: Record<string, any> | null;
  topic?: string | null;
  objectPath?: string | null;
  pluginName?: string | null;
  pluginVersion?: string | null;
  metadata?: Record<string, any> | null;
};

export type TrackingContext = {
  messageId: string | null;
  objectPath: string | null;
  userId: string | null;
};

function toJson(value: any) {
  return value == null ? null : JSON.stringify(value);
}

export async function startRun(params: StartRunParams) {
  const sql = `
    INSERT INTO "messageProcessingRuns" (
      "messageId", "projectId", "dataFeedId", "userId", "currentStage", "currentStatus", "rawObjectPath"
    ) VALUES ($1, $2, $3, $4, 'ingest', 'queued', $5)
    ON CONFLICT ("messageId")
    DO UPDATE SET
      "projectId" = EXCLUDED."projectId",
      "dataFeedId" = COALESCE(EXCLUDED."dataFeedId", "messageProcessingRuns"."dataFeedId"),
      "userId" = COALESCE(EXCLUDED."userId", "messageProcessingRuns"."userId"),
      "rawObjectPath" = COALESCE(EXCLUDED."rawObjectPath", "messageProcessingRuns"."rawObjectPath"),
      "updatedAt" = NOW()
  `;
  await pool.query(sql, [
    params.messageId,
    params.projectId,
    params.dataFeedId ?? null,
    params.userId ?? null,
    params.rawObjectPath ?? null,
  ]);

  await insertEvent({
    messageId: params.messageId,
    stage: "ingest",
    status: "queued",
    eventType: "MESSAGE_ACCEPTED",
    objectPath: params.rawObjectPath ?? null,
    metadata: params.metadata ?? null,
  });
}

export async function markStageStarted(params: {
  messageId: string;
  stage: PipelineStage;
  topic?: string | null;
  objectPath?: string | null;
  pluginName?: string | null;
  pluginVersion?: string | null;
  metadata?: Record<string, any> | null;
}) {
  await pool.query(
    `
      UPDATE "messageProcessingRuns"
      SET "currentStage" = $2,
          "currentStatus" = 'processing',
          "updatedAt" = NOW()
      WHERE "messageId" = $1
    `,
    [toBaseMessageId(params.messageId), params.stage],
  );

  await insertEvent({
    messageId: toBaseMessageId(params.messageId),
    stage: params.stage,
    status: "processing",
    eventType: `${params.stage.toUpperCase()}_STARTED`,
    topic: params.topic ?? null,
    objectPath: params.objectPath ?? null,
    pluginName: params.pluginName ?? null,
    pluginVersion: params.pluginVersion ?? null,
    metadata: params.metadata ?? null,
  });
}

export async function markStageCompleted(params: {
  messageId: string;
  stage: PipelineStage;
  topic?: string | null;
  objectPath?: string | null;
  pluginName?: string | null;
  pluginVersion?: string | null;
  nextStatus?: PipelineStatus;
  metadata?: Record<string, any> | null;
}) {
  const updates: string[] = [
    `"currentStage" = $2`,
    `"currentStatus" = $3`,
    `"updatedAt" = NOW()`,
    `"errorStage" = NULL`,
    `"errorCode" = NULL`,
    `"errorMessage" = NULL`,
    `"errorDetails" = NULL`,
  ];
  const values: any[] = [toBaseMessageId(params.messageId), params.stage, params.nextStatus ?? "completed"];
  let idx = values.length;

  if (params.stage === "validation") {
    idx += 1;
    updates.push(`"validatedObjectPath" = $${idx}`);
    values.push(params.objectPath ?? null);
  } else if (params.stage === "mapping") {
    idx += 1;
    updates.push(`"mappedObjectPath" = $${idx}`);
    values.push(params.objectPath ?? null);
  } else if (params.stage === "storage") {
    idx += 1;
    updates.push(`"processedObjectPath" = $${idx}`);
    values.push(params.objectPath ?? null);
    idx += 1;
    updates.push(`"completedAt" = $${idx}`);
    values.push(new Date().toISOString());
  } else if (params.stage === "outpost") {
    updates.push(`"outpostStatus" = 'completed'`);
    idx += 1;
    updates.push(`"completedAt" = $${idx}`);
    values.push(new Date().toISOString());
  }

  await pool.query(
    `UPDATE "messageProcessingRuns" SET ${updates.join(", ")} WHERE "messageId" = $1`,
    values,
  );

  await insertEvent({
    messageId: toBaseMessageId(params.messageId),
    stage: params.stage,
    status: "completed",
    eventType: `${params.stage.toUpperCase()}_COMPLETED`,
    topic: params.topic ?? null,
    objectPath: params.objectPath ?? null,
    pluginName: params.pluginName ?? null,
    pluginVersion: params.pluginVersion ?? null,
    metadata: params.metadata ?? null,
  });
}

export async function markStageFailed(params: StageFailureParams) {
  await pool.query(
    `
      UPDATE "messageProcessingRuns"
      SET "currentStage" = $2,
          "currentStatus" = 'failed',
          "errorStage" = $2,
          "errorCode" = $3,
          "errorMessage" = $4,
          "errorDetails" = $5::jsonb,
          "updatedAt" = NOW()
      WHERE "messageId" = $1
    `,
    [
      toBaseMessageId(params.messageId),
      params.stage,
      params.errorCode ?? null,
      params.errorMessage,
      toJson(params.errorDetails ?? null),
    ],
  );

  await insertEvent({
    messageId: toBaseMessageId(params.messageId),
    stage: params.stage,
    status: "failed",
    eventType: `${params.stage.toUpperCase()}_FAILED`,
    topic: params.topic ?? null,
    objectPath: params.objectPath ?? null,
    pluginName: params.pluginName ?? null,
    pluginVersion: params.pluginVersion ?? null,
    errorCode: params.errorCode ?? null,
    errorMessage: params.errorMessage,
    errorDetails: params.errorDetails ?? null,
    metadata: params.metadata ?? null,
  });
}

export async function insertEvent(params: StageEventParams) {
  await pool.query(
    `
      INSERT INTO "messageProcessingEvents" (
        "messageId", "stage", "status", "eventType", "topic", "objectPath",
        "pluginName", "pluginVersion", "errorCode", "errorMessage", "errorDetails", "metadata"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
    `,
    [
      toBaseMessageId(params.messageId),
      params.stage,
      params.status,
      params.eventType,
      params.topic ?? null,
      params.objectPath ?? null,
      params.pluginName ?? null,
      params.pluginVersion ?? null,
      params.errorCode ?? null,
      params.errorMessage ?? null,
      toJson(params.errorDetails ?? null),
      toJson(params.metadata ?? null),
    ],
  );
}

export async function isRunDeleted(messageId: string): Promise<boolean> {
  if (!messageId) return false;
  const res = await pool.query(
    `SELECT "currentStatus" FROM "messageProcessingRuns" WHERE "messageId" = $1 LIMIT 1`,
    [toBaseMessageId(messageId)],
  );
  return res.rows[0]?.currentStatus === "deleted";
}

export async function getRunByMessageId(messageId: string) {
  const res = await pool.query(
    `SELECT * FROM "messageProcessingRuns" WHERE "messageId" = $1 LIMIT 1`,
    [messageId],
  );
  return res.rows[0] ?? null;
}

// ── Runs list & detail (Pipeline Runs page) ─────────────────────────────────

const ALLOWED_SORT_COLUMNS = new Set([
  "createdAt",
  "updatedAt",
  "completedAt",
  "currentStatus",
  "currentStage",
]);

export async function listRuns(params: {
  page: number;
  limit: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: string;
  projectId?: string;
  dataFeedId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ data: any[]; total: number; page: number; limit: number }> {
  const {
    page = 0,
    limit = 50,
    sortBy = "createdAt",
    sortDir = "desc",
    status,
    projectId,
    dataFeedId,
    dateFrom,
    dateTo,
  } = params;

  const safeSortBy = ALLOWED_SORT_COLUMNS.has(sortBy) ? sortBy : "createdAt";
  const safeSortDir = sortDir === "asc" ? "ASC" : "DESC";

  const conditions: string[] = ["1=1"];
  const values: any[] = [];
  let idx = 0;

  if (status) {
    idx++;
    conditions.push(`r."currentStatus" = $${idx}`);
    values.push(status);
  }
  if (projectId) {
    idx++;
    conditions.push(`r."projectId" = $${idx}`);
    values.push(projectId);
  }
  if (dataFeedId) {
    idx++;
    conditions.push(`r."dataFeedId" = $${idx}`);
    values.push(dataFeedId);
  }
  if (dateFrom) {
    idx++;
    conditions.push(`r."createdAt" >= $${idx}`);
    values.push(dateFrom);
  }
  if (dateTo) {
    idx++;
    conditions.push(`r."createdAt" <= $${idx}`);
    values.push(dateTo);
  }

  const whereClause = conditions.join(" AND ");

  const countSql = `SELECT COUNT(*)::int AS total FROM "messageProcessingRuns" r WHERE ${whereClause}`;
  const dataSql = `
    SELECT
      r."messageId", r."projectId", r."dataFeedId", r."userId",
      r."currentStage", r."currentStatus",
      r."rawObjectPath", r."validatedObjectPath", r."mappedObjectPath", r."processedObjectPath",
      r."errorStage", r."errorCode", r."errorMessage",
      r."createdAt", r."updatedAt", r."completedAt",
      p."projectName",
      df."dataFeedName",
      fh."hash" AS "sourceHash", fh."fileSize", fh."contentType"
    FROM "messageProcessingRuns" r
    LEFT JOIN projects p ON r."projectId" = p."projectId"
    LEFT JOIN "dataFeeds" df ON r."dataFeedId" = df."dataFeedId"
    LEFT JOIN "fileHashes" fh ON r."messageId" = fh."messageId"
    WHERE ${whereClause}
    ORDER BY r."${safeSortBy}" ${safeSortDir}
    LIMIT $${idx + 1} OFFSET $${idx + 2}
  `;

  const offset = page * limit;
  const dataValues = [...values, limit, offset];

  const [countRes, dataRes] = await Promise.all([
    pool.query(countSql, values),
    pool.query(dataSql, dataValues),
  ]);

  return {
    data: dataRes.rows,
    total: countRes.rows[0]?.total ?? 0,
    page,
    limit,
  };
}

export async function getRunDetail(messageId: string) {
  const [runRes, events, fileHashRes] = await Promise.all([
    pool.query(
      `SELECT r.*, p."projectName", df."dataFeedName"
       FROM "messageProcessingRuns" r
       LEFT JOIN projects p ON r."projectId" = p."projectId"
       LEFT JOIN "dataFeeds" df ON r."dataFeedId" = df."dataFeedId"
       WHERE r."messageId" = $1 LIMIT 1`,
      [messageId],
    ),
    getEventsByMessageId(messageId),
    pool.query(
      `SELECT "hash", "sourceObjectPath", "fileSize", "contentType" FROM "fileHashes" WHERE "messageId" = $1 LIMIT 1`,
      [messageId],
    ),
  ]);

  const run = runRes.rows[0] ?? null;
  if (!run) return null;

  return {
    run,
    events,
    fileHash: fileHashRes.rows[0] ?? null,
  };
}

export async function softDeleteRun(messageId: string) {
  await pool.query(
    `UPDATE "messageProcessingRuns" SET "currentStatus" = 'deleted', "updatedAt" = NOW() WHERE "messageId" = $1`,
    [messageId],
  );
}

export async function resetRunForRetry(messageId: string, retryStage: string) {
  await pool.query(
    `UPDATE "messageProcessingRuns"
     SET "currentStatus" = 'queued',
         "currentStage" = $2,
         "errorStage" = NULL, "errorCode" = NULL, "errorMessage" = NULL, "errorDetails" = NULL,
         "updatedAt" = NOW()
     WHERE "messageId" = $1`,
    [messageId, retryStage],
  );

  await insertEvent({
    messageId,
    stage: retryStage as PipelineStage,
    status: "queued",
    eventType: "RETRY_INITIATED",
  });
}

export async function getEventsByMessageId(messageId: string) {
  // Aggregate events by stage+eventType to avoid returning 28K+ rows for
  // multi-record messages. Returns one row per unique stage/eventType with a
  // count and the earliest/latest timestamps.
  const res = await pool.query(
    `SELECT
       "stage",
       "status",
       "eventType",
       "pluginName",
       "pluginVersion",
       COUNT(*)::int AS "count",
       MIN("createdAt") AS "firstAt",
       MAX("createdAt") AS "lastAt"
     FROM "messageProcessingEvents"
     WHERE "messageId" = $1
     GROUP BY "stage", "status", "eventType", "pluginName", "pluginVersion"
     ORDER BY MIN("createdAt") ASC`,
    [messageId],
  );
  return res.rows;
}

export function extractTrackingContextFromKafkaValue(kafkaValue: any): TrackingContext {
  const userMetadata = kafkaValue?.Records?.[0]?.s3?.object?.userMetadata ?? {};
  const bucketName = kafkaValue?.Records?.[0]?.s3?.bucket?.name ?? null;
  const key = userMetadata["X-Amz-Meta-Filename"] || kafkaValue?.Records?.[0]?.s3?.object?.key || null;
  const decodedKey = typeof key === "string" ? decodeURIComponent(key) : null;

  return {
    messageId: userMetadata["X-Amz-Meta-Messageid"] ?? null,
    userId: userMetadata["X-Amz-Meta-Userid"] ?? null,
    objectPath: bucketName && decodedKey ? `${bucketName}/${decodedKey}` : decodedKey,
  };
}

export async function safeMarkStageFailed(params: StageFailureParams) {
  try {
    if (!params.messageId) return;
    await markStageFailed(params);
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack, messageId: params.messageId },
      "Failed to update message tracking failure state",
    );
  }
}
