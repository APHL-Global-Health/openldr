import express from "express";
import jwt from "jsonwebtoken";
const router = express.Router();
import * as minioUtil from "../utils/minioUtil";
import * as dataFeedService from "../services/dataFeedService";
import { schemas } from "@openldr/internal-database";
const { generateMessageMetadata } = schemas.messageMetadata;

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
  })
);

router.post("/process-feed", async (req, res) => {
  try {
    const dataFeedId: any = req.headers["x-datafeed-id"];
    if (!dataFeedId) {
      return res.status(400).json({ error: "Missing X-DataFeeed-Id header" });
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
      Buffer.from(parts[1], "base64").toString("utf-8")
    );
    const userId = payload?.sub; //client_id
    if (!userId) {
      return res
        .status(403)
        .json({ error: "No client_id found in token payload" });
    }

    // Get the data feed
    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      return res
        .status(404)
        .json({ error: `Data feed with ID ${dataFeedId} not found` });
    }

    const facilityId = dataFeed.facilityId;
    const bucket = facilityId.toLowerCase().replace(/_/g, "-"); // minio bucket names must be lowercase

    // Check if the bucket exists, error if it doesn't
    const bucketExists = await minioUtil.bucketExists(bucket);
    if (!bucketExists) {
      console.error(
        `Bucket '${bucket}' does not exist. Facility buckets must be created when the facility is created.`
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
    const messageMetadata = generateMessageMetadata({
      dataFeed: dataFeed,
      size: size,
      status: "raw",
      messageContentType: contentType,
      fileFormat: getFileExtension(contentType),
      // userId: userId,
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
      facilityId: facilityId,
    });
  } catch (error: any) {
    console.error("Error in /send-message route:", error);
    const statusCode = error.status || 500;
    const errorMessage = error.message || "An unexpected error occurred";
    return res.status(statusCode).json({ error: errorMessage });
  }
});

router.post("/send-message", async (req, res) => {
  try {
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

    const decodedToken: any = jwt.decode(jwtToken, { complete: true });

    // Extract dataFeedId from token payload
    const dataFeedId = decodedToken["payload"]["client_id"];
    if (!dataFeedId) {
      return res
        .status(403)
        .json({ error: "No client_id found in token payload" });
    }

    // Get the data feed
    const dataFeed = await dataFeedService.getDataFeedById(dataFeedId);
    if (!dataFeed) {
      return res
        .status(404)
        .json({ error: `Data feed with ID ${dataFeedId} not found` });
    }

    const facilityId = dataFeed.facilityId;
    const bucket = facilityId.toLowerCase().replace(/_/g, "-"); // minio bucket names must be lowercase

    // Check if the bucket exists, error if it doesn't
    const bucketExists = await minioUtil.bucketExists(bucket);
    if (!bucketExists) {
      console.error(
        `Bucket '${bucket}' does not exist. Facility buckets must be created when the facility is created.`
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

    const bodyData = req.body?.toString() || ""; // Raw Buffer data
    const size = bodyData.length;

    // create standard message metadata with enhanced content type info
    const messageMetadata = generateMessageMetadata({
      dataFeed: dataFeed,
      size: size,
      status: "raw",
      messageContentType: contentType,
      fileFormat: getFileExtension(contentType),
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
    });
  } catch (error: any) {
    console.error("Error in /send-message route:", error);
    const statusCode = error.status || 500;
    const errorMessage = error.message || "An unexpected error occurred";
    return res.status(statusCode).json({ error: errorMessage });
  }
});

router.post("/manual-data-entry", async (req, res) => {
  try {
    // Extract userId and facilityId from headers
    const userId: any = req.headers["x-user-id"];
    const facilityId: any = req.headers["x-facility-id"];

    if (!userId) {
      return res.status(400).json({ error: "Missing X-User-Id header" });
    }

    if (!facilityId) {
      return res.status(400).json({ error: "Missing X-Facility-Id header" });
    }

    // Get the default manual entry data feed for this facility
    const dataFeed =
      await dataFeedService.getDefaultManualEntryDataFeed(facilityId);
    if (!dataFeed) {
      return res.status(404).json({
        error: "No manual entry data feed found",
        message: `No "Manual Data Entry Lab Data" data feed configured for facility ${facilityId}`,
      });
    }

    const bucket = facilityId.toLowerCase().replace(/_/g, "-"); // minio bucket names must be lowercase

    // Check if the bucket exists, error if it doesn't
    const bucketExists = await minioUtil.bucketExists(bucket);
    if (!bucketExists) {
      console.error(
        `Bucket '${bucket}' does not exist. Facility buckets must be created when the facility is created.`
      );
      return res.status(404).json({
        error: "Facility bucket not found",
        message:
          "The facility bucket does not exist. Facility buckets must be created when the facility is created due to MinIO configuration requirements.",
      });
    }

    // Manual data entry is always JSON from web UI
    const contentType = "application/json";
    const bodyData = Buffer.from(JSON.stringify(req.body));
    const size = Buffer.byteLength(bodyData);

    // Create standard message metadata with real dataFeed object
    const messageMetadata = generateMessageMetadata({
      dataFeed: dataFeed,
      size: size,
      status: "raw",
      messageContentType: contentType,
      fileFormat: ".json",
      userId: userId,
    });

    // Save the message data to minio with metadata
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
      facilityId: facilityId,
    });
  } catch (error: any) {
    console.error("Error in /manual-data-entry route:", error);
    const statusCode = error.status || 500;
    const errorMessage = error.message || "An unexpected error occurred";
    return res.status(statusCode).json({ error: errorMessage });
  }
});

export default router;
