import * as Minio from "minio";
import { logger } from "../lib/logger";
import { type MinioUploadResult } from "../types";
import crypto from "crypto";
import fs from "fs";

// Create MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_HOSTNAME!,
  port: parseInt(process.env.MINIO_API_PORT || "9000", 10),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
});

/**
 * Ensure bucket exists, create if not
 */
export async function ensureBucketExists(bucketName: string): Promise<void> {
  try {
    logger.info({ bucket: bucketName }, "Checking if bucket exists");

    const exists = await bucketExists(bucketName);

    if (!exists) {
      logger.info({ bucket: bucketName }, "Bucket does not exist, creating...");
      await createBucket(bucketName);
      logger.info({ bucket: bucketName }, "Bucket created successfully");
    } else {
      logger.info({ bucket: bucketName }, "Bucket already exists");
    }
  } catch (error: any) {
    logger.error(
      { error, bucket: bucketName },
      "Failed to ensure bucket exists",
    );
    throw error;
  }
}

/**
 * Calculate SHA-256 hash of a file
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Upload file to MinIO
 */
export async function uploadFile(
  filePath: string,
  fileName: string,
  bucket: string,
): Promise<MinioUploadResult> {
  try {
    // Step 1: Ensure bucket exists
    logger.info({ bucket }, "Ensuring bucket exists");
    await ensureBucketExists(bucket);

    // Step 2: Get file stats
    const stats = fs.statSync(filePath);
    logger.info({ fileSize: stats.size }, "Got file stats");

    // Step 3: Generate object key
    const timestamp = Date.now();
    const objectKey = `${bucket}/${timestamp}-${fileName}`;
    logger.info({ objectKey }, "Generated object key");

    // Step 4: Prepare metadata
    const metadata = {
      "original-name": fileName,
      "upload-date": new Date().toISOString(),
      "file-size": stats.size.toString(),
    };

    // Step 5: Start upload with progress tracking
    logger.info({ bucket, objectKey, size: stats.size }, "Starting upload");

    // For progress tracking, we'll read the file in chunks
    const fileStream = fs.createReadStream(filePath);
    let uploadedBytes = 0;

    fileStream.on("data", (chunk) => {
      uploadedBytes += chunk.length;
      const percent = Math.round((uploadedBytes / stats.size) * 100);
      logger.info(
        `Upload progress: ${percent}% (${uploadedBytes}/${stats.size} bytes)`,
      );
    });

    await minioClient.fPutObject(bucket, objectKey, filePath, {
      "Content-Type": "application/x-sqlite3",
      ...metadata,
    });

    logger.info("Upload completed!");

    return {
      bucket,
      key: objectKey,
      path: `${bucket}/${objectKey}`,
      size: stats.size,
    };
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack, bucket },
      "MinIO upload failed",
    );
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Download file from MinIO
 */
export async function downloadFile(
  bucket: string,
  key: string,
  destinationPath: string,
): Promise<string> {
  try {
    await minioClient.fGetObject(bucket, key, destinationPath);

    logger.info(
      {
        bucket,
        key,
        destinationPath,
      },
      "File downloaded from MinIO",
    );

    return destinationPath;
  } catch (error) {
    logger.error(error, "MinIO download error");
    throw new Error(`Failed to download file: ${(error as Error).message}`);
  }
}

/**
 * Delete file from MinIO
 */
export async function deleteFile(
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await minioClient.removeObject(bucket, key);
    logger.info({ bucket, key }, "File deleted from MinIO");
    return true;
  } catch (error) {
    logger.error(error, "MinIO delete error");
    throw new Error(`Failed to delete file: ${(error as Error).message}`);
  }
}

/**
 * Create a bucket
 */
export async function createBucket(bucketName: string): Promise<void> {
  try {
    // Check if bucket already exists
    const exists = await bucketExists(bucketName);

    if (exists) {
      logger.info({ bucket: bucketName }, "Bucket already exists");
      return;
    }

    // Create the bucket
    await minioClient.makeBucket(bucketName, "us-east-1");
    logger.info({ bucket: bucketName }, "Created MinIO bucket");

    // Set per-prefix lifecycle policies (configurable via MINIO_TTL_* env vars)
    await setBucketLifecycle(bucketName);

    // Set bucket policy (allow read/write for authenticated users)
    await setBucketPolicy(bucketName);
  } catch (error) {
    logger.error({ error, bucket: bucketName }, "Failed to create bucket");
    throw new Error(`Failed to create lab bucket: ${(error as Error).message}`);
  }
}

/**
 * Delete a bucket (use with caution)
 */
export async function deleteBucket(
  bucketName: string,
  force: boolean = false,
): Promise<void> {
  try {
    const exists = await bucketExists(bucketName);

    if (!exists) {
      logger.warn({ bucket: bucketName }, "Bucket does not exist");
      return;
    }

    if (force) {
      // Remove all objects first
      await emptyBucket(bucketName);
    }

    // Remove the bucket
    await minioClient.removeBucket(bucketName);
    logger.info({ bucket: bucketName }, "Deleted MinIO bucket");
  } catch (error) {
    logger.error({ error, bucket: bucketName }, "Failed to delete bucket");
    throw new Error(`Failed to delete lab bucket: ${(error as Error).message}`);
  }
}

/**
 * Empty all objects from a bucket
 */
async function emptyBucket(bucketName: string): Promise<void> {
  try {
    const objectsList: string[] = [];

    // List all objects
    const objectsStream = minioClient.listObjects(bucketName, "", true);

    // Collect all object keys
    await new Promise<void>((resolve, reject) => {
      objectsStream.on("data", (obj: any) => {
        if (obj.name) {
          objectsList.push(obj.name);
        }
      });
      objectsStream.on("error", reject);
      objectsStream.on("end", () => resolve());
    });

    if (objectsList.length === 0) {
      return;
    }

    // Delete all objects
    await minioClient.removeObjects(bucketName, objectsList);

    logger.info(
      { bucket: bucketName, count: objectsList.length },
      "Removed objects from bucket",
    );
  } catch (error) {
    logger.error({ error, bucket: bucketName }, "Failed to empty bucket");
    throw error;
  }
}

// Lifecycle TTLs (days) — configurable via environment variables
const LIFECYCLE_RAW_DAYS = parseInt(process.env.MINIO_TTL_RAW_DAYS || "7", 10);
const LIFECYCLE_VALIDATED_DAYS = parseInt(process.env.MINIO_TTL_VALIDATED_DAYS || "3", 10);
const LIFECYCLE_MAPPED_DAYS = parseInt(process.env.MINIO_TTL_MAPPED_DAYS || "3", 10);
const LIFECYCLE_PROCESSED_DAYS = parseInt(process.env.MINIO_TTL_PROCESSED_DAYS || "90", 10);
const LIFECYCLE_SOURCES_DAYS = parseInt(process.env.MINIO_TTL_SOURCES_DAYS || "0", 10); // 0 = never expire

/**
 * Set per-prefix lifecycle policies for pipeline stage objects.
 * sources/ objects are kept indefinitely by default (content-addressed, deduplicated).
 */
async function setBucketLifecycle(bucketName: string): Promise<void> {
  try {
    const rules: any[] = [
      {
        ID: "expire-raw",
        Status: "Enabled",
        Filter: { Prefix: "raw/" },
        Expiration: { Days: LIFECYCLE_RAW_DAYS },
      },
      {
        ID: "expire-validated",
        Status: "Enabled",
        Filter: { Prefix: "validated/" },
        Expiration: { Days: LIFECYCLE_VALIDATED_DAYS },
      },
      {
        ID: "expire-mapped",
        Status: "Enabled",
        Filter: { Prefix: "mapped/" },
        Expiration: { Days: LIFECYCLE_MAPPED_DAYS },
      },
      {
        ID: "expire-processed",
        Status: "Enabled",
        Filter: { Prefix: "processed/" },
        Expiration: { Days: LIFECYCLE_PROCESSED_DAYS },
      },
    ];

    // Only add sources/ expiration if explicitly configured
    if (LIFECYCLE_SOURCES_DAYS > 0) {
      rules.push({
        ID: "expire-sources",
        Status: "Enabled",
        Filter: { Prefix: "sources/" },
        Expiration: { Days: LIFECYCLE_SOURCES_DAYS },
      });
    }

    await minioClient.setBucketLifecycle(bucketName, { Rule: rules });

    logger.info(
      {
        bucket: bucketName,
        ttl: {
          raw: LIFECYCLE_RAW_DAYS,
          validated: LIFECYCLE_VALIDATED_DAYS,
          mapped: LIFECYCLE_MAPPED_DAYS,
          processed: LIFECYCLE_PROCESSED_DAYS,
          sources: LIFECYCLE_SOURCES_DAYS || "never",
        },
      },
      "Set per-prefix lifecycle policies for bucket",
    );
  } catch (error) {
    logger.warn(
      { error, bucket: bucketName },
      "Failed to set lifecycle policy",
    );
    // Don't throw - lifecycle is optional
  }
}

/**
 * Set bucket policy (allow authenticated access)
 */
async function setBucketPolicy(bucketName: string): Promise<void> {
  try {
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetBucketLocation", "s3:ListBucket"],
          Resource: [`arn:aws:s3:::${bucketName}`],
        },
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));

    logger.info({ bucket: bucketName }, "Set policy for bucket");
  } catch (error) {
    logger.warn({ error, bucket: bucketName }, "Failed to set bucket policy");
    // Don't throw - policy is optional
  }
}

/**
 * Get bucket statistics
 */
export async function getBucketStats(bucketName: string): Promise<{
  objectCount: number;
  totalSize: number;
}> {
  try {
    let objectCount = 0;
    let totalSize = 0;

    const objectsStream = minioClient.listObjects(bucketName, "", true);

    await new Promise<void>((resolve, reject) => {
      objectsStream.on("data", (obj: any) => {
        objectCount++;
        totalSize += obj.size || 0;
      });
      objectsStream.on("error", reject);
      objectsStream.on("end", () => resolve());
    });

    return { objectCount, totalSize };
  } catch (error) {
    logger.error({ error, bucket: bucketName }, "Failed to get bucket stats");
    throw error;
  }
}

/**
 * Check if bucket exists
 */
export async function bucketExists(bucketName: string): Promise<boolean> {
  try {
    return await minioClient.bucketExists(bucketName);
  } catch (error: any) {
    return false;
  }
}

/**
 * List all buckets
 */
export async function listBuckets(): Promise<string[]> {
  try {
    const buckets = await minioClient.listBuckets();
    return buckets.map((b: any) => b.name);
  } catch (error) {
    logger.error(error, "Failed to list buckets");
    throw error;
  }
}

/**
 * Generate bucket name from lab code
 */
export function generateBucketName(labCode: string): string {
  // Convert to lowercase and replace non-alphanumeric chars with hyphens
  const sanitized = labCode
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

  return `lab-${sanitized}`;
}

/**
 * Validate bucket name
 */
export function validateBucketName(bucketName: string): boolean {
  // MinIO/S3 bucket naming rules:
  // - Must be between 3 and 63 characters
  // - Must start and end with lowercase letter or number
  // - Can contain lowercase letters, numbers, and hyphens
  const bucketNameRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
  return bucketNameRegex.test(bucketName);
}

/**
 * Delete all pipeline stage objects for a specific run.
 * Paths are in "bucket/key" format.
 */
export async function deleteRunObjects(paths: {
  raw?: string | null;
  validated?: string | null;
  mapped?: string | null;
  processed?: string | null;
}): Promise<{ deleted: string[]; errors: string[] }> {
  const deleted: string[] = [];
  const errors: string[] = [];

  for (const [stage, fullPath] of Object.entries(paths)) {
    if (!fullPath) continue;
    const slashIdx = fullPath.indexOf("/");
    if (slashIdx < 0) {
      errors.push(`${stage}: invalid path format "${fullPath}"`);
      continue;
    }
    const bucket = fullPath.substring(0, slashIdx);
    const key = fullPath.substring(slashIdx + 1);
    try {
      await minioClient.removeObject(bucket, key);
      deleted.push(fullPath);
    } catch (err: any) {
      errors.push(`${stage}: ${err.message}`);
    }
  }

  return { deleted, errors };
}

/**
 * Delete all objects under a prefix in a bucket.
 */
export async function purgeObjectsByPrefix(
  bucketName: string,
  prefix: string,
): Promise<{ deletedCount: number }> {
  const keys: string[] = [];
  const objectsStream = minioClient.listObjects(bucketName, prefix, true);

  await new Promise<void>((resolve, reject) => {
    objectsStream.on("data", (obj: any) => {
      if (obj.name) keys.push(obj.name);
    });
    objectsStream.on("error", reject);
    objectsStream.on("end", () => resolve());
  });

  if (keys.length > 0) {
    await minioClient.removeObjects(bucketName, keys);
  }

  logger.info(
    { bucket: bucketName, prefix, deletedCount: keys.length },
    "Purged objects by prefix",
  );

  return { deletedCount: keys.length };
}

export async function putObject({
  bucketName,
  objectName,
  data,
  messageMetadata = {},
}: {
  bucketName: string;
  objectName: string;
  data: any;
  messageMetadata: any;
}) {
  try {
    if (!data) {
      throw new Error("Data is required for putObject");
    }

    // Convert data to Buffer
    const buffer = Buffer.from(data);

    // Get size from metadata if available, otherwise use buffer length
    const size = messageMetadata.Size
      ? parseInt(messageMetadata.Size)
      : buffer.length;

    // Convert metadata to MinIO format (all values must be strings)
    const minioMetadata = Object.entries(messageMetadata).reduce(
      (acc: any, [key, value]) => {
        acc[`x-amz-meta-${key}`] = Array.isArray(value)
          ? value.join(",")
          : String(value);
        return acc;
      },
      {},
    );

    return await minioClient.putObject(
      bucketName,
      objectName,
      buffer,
      size,
      minioMetadata,
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      `Error putting object ${objectName} to bucket ${bucketName}`,
    );
    throw error;
  }
}

export async function getObject({
  bucketName,
  objectName,
}: {
  bucketName: string;
  objectName: string;
}) {
  try {
    return await minioClient.getObject(bucketName, objectName);
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      `Error getting object ${objectName} from bucket ${bucketName}`,
    );
    throw error;
  }
}

export async function statObject({
  bucketName,
  objectName,
}: {
  bucketName: string;
  objectName: string;
}) {
  try {
    return await minioClient.statObject(bucketName, objectName);
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      `Error getting object metadata ${objectName} from bucket ${bucketName}`,
    );
    throw error;
  }
}
