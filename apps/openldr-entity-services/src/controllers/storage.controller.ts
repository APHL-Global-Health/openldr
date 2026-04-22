import { Router, type Request, type Response } from "express";
import {
  uploadFile,
  downloadFile,
  deleteFile,
  createBucket,
  deleteBucket,
  getBucketStats,
  bucketExists,
  listBuckets,
  generateBucketName,
  validateBucketName,
  ensureBucketExists,
  calculateFileHash,
} from "../services/minio.service";
import { logger } from "../lib/logger";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(os.tmpdir(), "uploads"),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

/**
 * POST /minio/upload
 * Upload a file to MinIO
 */
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file provided",
        });
      }

      const { bucket } = req.body;

      if (!bucket) {
        return res.status(400).json({
          success: false,
          error: "Bucket name is required",
        });
      }

      // Validate bucket name
      if (!validateBucketName(bucket)) {
        return res.status(400).json({
          success: false,
          error: "Invalid bucket name format",
        });
      }

      // Calculate file hash
      const fileHash = await calculateFileHash(req.file.path);

      // Upload to MinIO
      const result = await uploadFile(
        req.file.path,
        req.file.originalname,
        bucket,
      );

      // Clean up temp file
      fs.unlinkSync(req.file.path);

      logger.info(
        {
          bucket,
          fileName: req.file.originalname,
          size: result.size,
          hash: fileHash,
        },
        "File uploaded successfully",
      );

      return res.status(200).json({
        success: true,
        data: {
          ...result,
          hash: fileHash,
          originalName: req.file.originalname,
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "Upload failed");

      // Clean up temp file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        success: false,
        error: error.message || "Failed to upload file",
      });
    }
  },
);

/**
 * GET /minio/download/:bucket/:key
 * Download a file from MinIO
 */
router.get("/download/:bucket/:key(*)", async (req: Request, res: Response) => {
  try {
    const { bucket, key } = req.params;

    if (!bucket || !key) {
      return res.status(400).json({
        success: false,
        error: "Bucket and key are required",
      });
    }

    // Create temp directory for download
    const tempDir = path.join(os.tmpdir(), "downloads");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(
      tempDir,
      `${Date.now()}-${path.basename(key)}`,
    );

    // Download from MinIO
    await downloadFile(bucket, key, tempFilePath);

    // Send file to client
    res.download(tempFilePath, path.basename(key), (err) => {
      // Clean up temp file after sending
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      if (err) {
        logger.error({ error: err }, "Error sending file");
      }
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Download failed");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to download file",
    });
  }
});

/**
 * DELETE /minio/file/:bucket/:key
 * Delete a file from MinIO
 */
router.delete("/file/:bucket/:key(*)", async (req: Request, res: Response) => {
  try {
    const { bucket, key } = req.params;

    if (!bucket || !key) {
      return res.status(400).json({
        success: false,
        error: "Bucket and key are required",
      });
    }

    const deleted = await deleteFile(bucket, key);

    logger.info({ bucket, key }, "File deleted successfully");

    return res.status(200).json({
      success: true,
      data: { deleted, bucket, key },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Delete failed");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to delete file",
    });
  }
});

/**
 * POST /minio/bucket
 * Create a new bucket
 */
router.post("/bucket", async (req: Request, res: Response) => {
  try {
    const { bucketName, labCode } = req.body;

    let finalBucketName = bucketName;

    // If labCode provided, generate bucket name
    if (labCode) {
      finalBucketName = generateBucketName(labCode);
    }

    if (!finalBucketName) {
      return res.status(400).json({
        success: false,
        error: "Either bucketName or labCode is required",
      });
    }

    // Validate bucket name
    if (!validateBucketName(finalBucketName)) {
      return res.status(400).json({
        success: false,
        error: "Invalid bucket name format",
      });
    }

    await createBucket(finalBucketName);

    logger.info({ bucket: finalBucketName }, "Bucket created successfully");

    return res.status(201).json({
      success: true,
      data: { bucketName: finalBucketName },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Bucket creation failed");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create bucket",
    });
  }
});

/**
 * DELETE /minio/bucket/:bucketName
 * Delete a bucket
 */
router.delete("/bucket/:bucketName", async (req: Request, res: Response) => {
  try {
    const { bucketName } = req.params;
    const { force } = req.query;

    if (!bucketName) {
      return res.status(400).json({
        success: false,
        error: "Bucket name is required",
      });
    }

    await deleteBucket(bucketName, force === "true");

    logger.info({ bucket: bucketName }, "Bucket deleted successfully");

    return res.status(200).json({
      success: true,
      data: { bucketName, deleted: true },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Bucket deletion failed");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to delete bucket",
    });
  }
});

/**
 * GET /minio/bucket/:bucketName/stats
 * Get bucket statistics
 */
router.get("/bucket/:bucketName/stats", async (req: Request, res: Response) => {
  try {
    const { bucketName } = req.params;

    if (!bucketName) {
      return res.status(400).json({
        success: false,
        error: "Bucket name is required",
      });
    }

    const stats = await getBucketStats(bucketName);

    return res.status(200).json({
      success: true,
      data: {
        bucketName,
        ...stats,
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to get bucket stats");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to get bucket statistics",
    });
  }
});

/**
 * GET /minio/bucket/:bucketName/exists
 * Check if bucket exists
 */
router.get(
  "/bucket/:bucketName/exists",
  async (req: Request, res: Response) => {
    try {
      const { bucketName } = req.params;

      if (!bucketName) {
        return res.status(400).json({
          success: false,
          error: "Bucket name is required",
        });
      }

      const exists = await bucketExists(bucketName);

      return res.status(200).json({
        success: true,
        data: { bucketName, exists },
      });
    } catch (error: any) {
      logger.error(
        { error: error.message },
        "Failed to check bucket existence",
      );
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to check bucket",
      });
    }
  },
);

/**
 * GET /minio/buckets
 * List all buckets
 */
router.get("/buckets", async (_req: Request, res: Response) => {
  try {
    const buckets = await listBuckets();

    return res.status(200).json({
      success: true,
      data: {
        buckets,
        count: buckets.length,
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to list buckets");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to list buckets",
    });
  }
});

/**
 * POST /minio/bucket/:bucketName/ensure
 * Ensure bucket exists (create if not)
 */
router.post(
  "/bucket/:bucketName/ensure",
  async (req: Request, res: Response) => {
    try {
      const { bucketName } = req.params;

      if (!bucketName) {
        return res.status(400).json({
          success: false,
          error: "Bucket name is required",
        });
      }

      // Validate bucket name
      if (!validateBucketName(bucketName)) {
        return res.status(400).json({
          success: false,
          error: "Invalid bucket name format",
        });
      }

      await ensureBucketExists(bucketName);

      return res.status(200).json({
        success: true,
        data: { bucketName, ensured: true },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "Failed to ensure bucket exists");
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to ensure bucket exists",
      });
    }
  },
);

/**
 * POST /minio/bucket/validate
 * Validate bucket name
 */
router.post("/bucket/validate", (req: Request, res: Response) => {
  try {
    const { bucketName } = req.body;

    if (!bucketName) {
      return res.status(400).json({
        success: false,
        error: "Bucket name is required",
      });
    }

    const isValid = validateBucketName(bucketName);

    return res.status(200).json({
      success: true,
      data: {
        bucketName,
        valid: isValid,
        rules: {
          length: "Must be between 3 and 63 characters",
          start: "Must start with lowercase letter or number",
          end: "Must end with lowercase letter or number",
          allowed: "Can contain lowercase letters, numbers, and hyphens",
        },
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Validation failed");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to validate bucket name",
    });
  }
});

/**
 * POST /minio/bucket/generate
 * Generate bucket name from lab code
 */
router.post("/bucket/generate", (req: Request, res: Response) => {
  try {
    const { labCode } = req.body;

    if (!labCode) {
      return res.status(400).json({
        success: false,
        error: "Lab code is required",
      });
    }

    const bucketName = generateBucketName(labCode);
    const isValid = validateBucketName(bucketName);

    return res.status(200).json({
      success: true,
      data: {
        labCode,
        bucketName,
        valid: isValid,
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Generation failed");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate bucket name",
    });
  }
});

/**
 * POST /minio/file/hash
 * Calculate hash of uploaded file
 */
router.post(
  "/file/hash",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file provided",
        });
      }

      const fileHash = await calculateFileHash(req.file.path);

      // Clean up temp file
      fs.unlinkSync(req.file.path);

      return res.status(200).json({
        success: true,
        data: {
          fileName: req.file.originalname,
          hash: fileHash,
          size: req.file.size,
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "Hash calculation failed");

      // Clean up temp file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        success: false,
        error: error.message || "Failed to calculate file hash",
      });
    }
  },
);

export default router;
