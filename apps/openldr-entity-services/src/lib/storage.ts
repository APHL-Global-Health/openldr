// ─────────────────────────────────────────────────────────────────────────────
// MinIO client + extension payload helpers
// ─────────────────────────────────────────────────────────────────────────────

import { Readable } from "stream";
import { minioClient } from "./minio-client";

export { minioClient };

const BUCKET = process.env.MINIO_BUCKET! || "extensions";

// ── Bucket bootstrap ──────────────────────────────────────────────────────

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(
      BUCKET,
      process.env.MINIO_REGION || "us-east-1",
    );
    console.log(`[MinIO] Created bucket: ${BUCKET}`);
  } else {
    console.log(`[MinIO] Bucket ready: ${BUCKET}`);
  }
}

// ── Storage key convention ────────────────────────────────────────────────
// extensions/{id}/{version}/payload
// This allows multiple versions to coexist in the same bucket.

export function makeStorageKey(id: string, version: string): string {
  return `extensions/${id}/${version}/payload`;
}

// ── Put payload ───────────────────────────────────────────────────────────

export async function putExtensionPayload(
  id: string,
  version: string,
  payload: string,
  contentType = "text/plain",
): Promise<string> {
  const key = makeStorageKey(id, version);
  const buf = Buffer.from(payload, "utf8");
  await minioClient.putObject(BUCKET, key, buf, buf.length, {
    "Content-Type": contentType,
    "X-Extension-Id": id,
    "X-Extension-Version": version,
  });
  console.log(`[MinIO] Stored extension payload: ${key} (${buf.length} bytes)`);
  return key;
}

// ── Get payload ───────────────────────────────────────────────────────────

export async function getExtensionPayload(storageKey: string): Promise<string> {
  const stream = await minioClient.getObject(BUCKET, storageKey);
  return streamToString(stream);
}

// ── Delete payload ────────────────────────────────────────────────────────

export async function deleteExtensionPayload(
  storageKey: string,
): Promise<void> {
  await minioClient.removeObject(BUCKET, storageKey);
  console.log(`[MinIO] Deleted: ${storageKey}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}
