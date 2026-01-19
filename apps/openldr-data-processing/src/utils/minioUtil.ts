import * as Minio from "minio";

// Check for required environment variables
if (
  !process.env.DATA_PROCESSING_MINIO_ACCESS_KEY ||
  !process.env.DATA_PROCESSING_MINIO_SECRET_KEY
) {
  throw new Error("MinIO credentials not found in environment variables");
}

const minioClient = new Minio.Client({
  endPoint: "openldr-minio",
  port: 9000,
  accessKey: process.env.DATA_PROCESSING_MINIO_ACCESS_KEY,
  secretKey: process.env.DATA_PROCESSING_MINIO_SECRET_KEY,
  useSSL: false,
});

async function putObject({
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
      {}
    );

    return await minioClient.putObject(
      bucketName,
      objectName,
      buffer,
      size,
      minioMetadata
    );
  } catch (error) {
    console.error(
      `Error putting object ${objectName} to bucket ${bucketName}:`,
      error
    );
    throw error;
  }
}

async function bucketExists(bucketName: string) {
  try {
    return await minioClient.bucketExists(bucketName);
  } catch (error) {
    console.error(`Error checking if bucket ${bucketName} exists:`, error);
    throw error;
  }
}

export { putObject, bucketExists };
