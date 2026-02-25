import express from "express";
import * as minioUtil from "../services/minio.service";
import { utils } from "@repo/openldr-core";
import { getDataFeedById } from "../services/datafeed.service";
import { logger } from "../lib/logger";

const router = express.Router();

// Supported content types mapping (alphabetically ordered)
const SUPPORTED_CONTENT_TYPES: any = {
  "application/fhir+json": ".json",
  "application/fhir+xml": ".xml",
  "application/hl7-v2": ".hl7",
  "application/json": ".json",
  "application/octet-stream": ".dat", // Default for binary data
  "application/pdf": ".pdf",
  "application/xml": ".xml",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "text/csv": ".csv",
  "text/plain": ".txt",
  "text/xml": ".xml",
};

// Get list of supported content types
const getSupportedContentTypes = () => {
  return Object.keys(SUPPORTED_CONTENT_TYPES);
};

// Check if content type is supported
const isContentTypeSupported = (contentType: string) => {
  return SUPPORTED_CONTENT_TYPES.hasOwnProperty(contentType);
};

// Determine file extension based on content type
const getFileExtension = (contentType: string) => {
  return SUPPORTED_CONTENT_TYPES[contentType] || ".txt";
};

// Middleware to handle ANY content type (not just JSON)
router.use(
  express.raw({
    type: "*/*", // Accept any content type
    limit: "50mb", // Increase limit for large files
  }),
);

router.post("/process-feed", async (req, res) => {
  try {
    const dataFeedId: any = req.headers["x-datafeed-id"];
    if (!dataFeedId) {
      return res.status(400).json({ error: "Missing X-DataFeed-Id header" });
    }

    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const jwtToken = authHeader.split(" ")[1];
    if (!jwtToken) {
      return res
        .status(401)
        .json({ error: "Invalid Authorization header format" });
    }

    // Decode the JWT (base64)
    const parts: any[] = jwtToken.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (second part)
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8"),
    );
    const userId = payload?.sub; //client_id
    if (!userId) {
      return res
        .status(403)
        .json({ error: "No client_id found in token payload" });
    }

    // Get the data feed
    const dataFeed = await getDataFeedById(dataFeedId);
    if (!dataFeed) {
      return res
        .status(404)
        .json({ error: `Data feed with ID ${dataFeedId} not found` });
    }

    const projectId = dataFeed.projectId;
    const bucket = projectId.toLowerCase().replace(/_/g, "-"); // minio bucket names must be lowercase

    // Check if the bucket exists, error if it doesn't
    const bucketExists = await minioUtil.bucketExists(bucket);
    if (!bucketExists) {
      logger.error(
        `Bucket '${bucket}' does not exist. Facility buckets must be created when the facility is created.`,
      );
      return res.status(404).json({
        error: "Facility bucket not found",
        message:
          "The facility bucket does not exist. Facility buckets must be created when the facility is created due to MinIO configuration requirements.",
      });
    }

    // Handle ANY content type - req.body is now a Buffer with raw data
    const contentType =
      req.headers["content-type"] || "application/octet-stream";

    // Validate content type is supported
    if (!isContentTypeSupported(contentType)) {
      const supportedTypes = getSupportedContentTypes();
      return res.status(400).json({
        error: "Unsupported content type",
        message: `Content-Type '${contentType}' is not supported. Please use one of the supported content types.`,
        supportedContentTypes: supportedTypes,
        received: contentType,
      });
    }

    // const bodyData = req.body; // Raw Buffer data
    // const size = Buffer.byteLength(bodyData);

    let bodyData = req.body?.toString() || ""; // Raw Buffer data
    let size = bodyData.length;
    if (getFileExtension(contentType) === ".json") {
      bodyData = Buffer.from(JSON.stringify(req.body));
      size = Buffer.byteLength(bodyData);
      // bodyData = req.body ? JSON.stringify(req.body) : ""; // Raw Buffer data
    }

    // create standard message metadata with enhanced content type info
    const messageMetadata = utils.generateMessageMetadata({
      dataFeed: dataFeed,
      size: size,
      status: "raw",
      messageContentType: contentType,
      fileFormat: getFileExtension(contentType),
      userId: userId,
    });

    // Save the raw message data to minio with metadata
    await minioUtil.putObject({
      bucketName: bucket,
      objectName: messageMetadata.FileName,
      data: bodyData,
      messageMetadata: messageMetadata,
    });

    // return a 200 status with the messageId
    res.status(200).json({
      message: "Message successfully processed.",
      messageId: messageMetadata.MessageId,
      contentType: contentType,
      size: size,
      userId: userId,
      projectId: projectId,
    });
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Error in /send-message route",
    );
    const statusCode = error.status || 500;
    const errorMessage = error.message || "An unexpected error occurred";
    return res.status(statusCode).json({ error: errorMessage });
  }
});

export default router;
