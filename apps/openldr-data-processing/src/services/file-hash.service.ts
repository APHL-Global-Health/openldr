import crypto from "crypto";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const ENSURE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "fileHashes" (
    "hash" VARCHAR(64) NOT NULL,
    "dataFeedId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sourceObjectPath" TEXT NULL,
    "fileSize" BIGINT NULL,
    "contentType" VARCHAR(100) NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("hash", "dataFeedId")
  )
`;

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  try {
    await pool.query(ENSURE_TABLE_SQL);
    tableEnsured = true;
  } catch (err: any) {
    logger.warn({ error: err.message }, "fileHashes table ensure failed (may already exist)");
    tableEnsured = true; // don't retry on every request
  }
}

export function hashBuffer(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function findByHash(hash: string, dataFeedId: string) {
  await ensureTable();
  const res = await pool.query(
    `SELECT * FROM "fileHashes" WHERE "hash" = $1 AND "dataFeedId" = $2 LIMIT 1`,
    [hash, dataFeedId],
  );
  return res.rows[0] ?? null;
}

export async function insertHash(params: {
  hash: string;
  dataFeedId: string;
  messageId: string;
  projectId: string;
  sourceObjectPath?: string | null;
  fileSize?: number | null;
  contentType?: string | null;
}) {
  await ensureTable();
  await pool.query(
    `INSERT INTO "fileHashes" ("hash", "dataFeedId", "messageId", "projectId", "sourceObjectPath", "fileSize", "contentType")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT ("hash", "dataFeedId") DO UPDATE SET "messageId" = EXCLUDED."messageId", "createdAt" = NOW()`,
    [
      params.hash,
      params.dataFeedId,
      params.messageId,
      params.projectId,
      params.sourceObjectPath ?? null,
      params.fileSize ?? null,
      params.contentType ?? null,
    ],
  );
}
