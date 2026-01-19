import * as Minio from "minio";

// Check for required environment variables
if (
  !process.env.PLUGIN_MINIO_ACCESS_KEY ||
  !process.env.PLUGIN_MINIO_SECRET_KEY
) {
  throw new Error("MinIO credentials not found in environment variables");
}

const minioClient = new Minio.Client({
  endPoint: "openldr-minio",
  port: 9000,
  accessKey: process.env.PLUGIN_MINIO_ACCESS_KEY,
  secretKey: process.env.PLUGIN_MINIO_SECRET_KEY,
  useSSL: false,
});

async function getObject({
  bucketName,
  objectName,
}: {
  bucketName: string;
  objectName: string;
}) {
  try {
    return await minioClient.getObject(bucketName, objectName);
  } catch (error) {
    console.error(
      `Error getting object ${objectName} from bucket ${bucketName}:`,
      error
    );
    throw error;
  }
}

async function putObject({
  bucketName,
  objectName,
  data,
}: {
  bucketName: string;
  objectName: string;
  data: any;
}) {
  try {
    if (!data) {
      throw new Error("Data is required for putObject");
    }

    // Handle both stream and buffer/string inputs
    if (typeof data.pipe === "function") {
      // It's a stream
      const size = data.size || 0; // Some streams might have size property
      return await minioClient.putObject(bucketName, objectName, data, size);
    } else {
      // It's a buffer or string
      const buffer = Buffer.from(data);
      return await minioClient.putObject(
        bucketName,
        objectName,
        buffer,
        buffer.length
      );
    }
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

async function deleteObject({
  bucketName,
  objectName,
}: {
  bucketName: string;
  objectName: string;
}) {
  try {
    const objectsList: any = [];

    const objectsStream = minioClient.listObjects(bucketName, objectName, true);

    objectsStream.on("data", function (obj) {
      objectsList.push(obj.name);
    });

    objectsStream.on("error", function (e) {
      console.log(e);
    });

    objectsStream.on("end", async () => {
      await minioClient.removeObjects(bucketName, objectsList);
    });
  } catch (error) {
    console.error(`Error deleting object ${bucketName}/${objectName}:`, error);
    throw error;
  }
}

export { getObject, putObject, bucketExists, deleteObject };
