import * as Minio from "minio";


const minioClient = new Minio.Client({
   endPoint: process.env.MINIO_HOSTNAME!,
  port: parseInt(process.env.MINIO_API_PORT || "9000", 10),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ROOT_USER!,
  secretKey: process.env.MINIO_ROOT_PASSWORD!,
});

async function bucketExists(bucketName: string) {
  try {
    return await minioClient.bucketExists(bucketName);
  } catch (error) {
    console.error(`Error checking if bucket ${bucketName} exists:`, error);
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

async function createBucket(bucketName: string) {
  if (!_validateBucketName(bucketName)) {
    throw new Error(`Invalid bucket name: ${bucketName}`);
  }
  try {
    await minioClient.makeBucket(bucketName);
    console.log(`Successfully created bucket ${bucketName}`);
  } catch (error) {
    console.error(`Error creating bucket ${bucketName}:`, error);
    throw error;
  }
}

async function deleteBucket(bucketName: string) {
  if (!_validateBucketName(bucketName)) {
    throw new Error(`Invalid bucket name: ${bucketName}`);
  }
  try {
    // Check if bucket exists before attempting to delete
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      throw new Error(`Bucket ${bucketName} does not exist`);
    }

    await minioClient.removeBucket(bucketName);
    console.log(`Successfully deleted bucket ${bucketName}`);
  } catch (error) {
    console.error(`Error deleting bucket ${bucketName}:`, error);
    throw error;
  }
}

async function setBucketKafkaNotifications(bucketName: string) {
  // Configure bucket notifications
  const arnPrefixEvents = [
    { arn: "arn:minio:sqs::raw-kafka-notification:kafka", prefix: "raw/" },
    {
      arn: "arn:minio:sqs::validated-kafka-notification:kafka",
      prefix: "validated/",
    },
    {
      arn: "arn:minio:sqs::mapped-kafka-notification:kafka",
      prefix: "mapped/",
    },
    {
      arn: "arn:minio:sqs::processed-kafka-notification:kafka",
      prefix: "processed/",
    },
  ];

  const bucketNotification = new Minio.NotificationConfig();

  for (const object of arnPrefixEvents) {
    const event = new Minio.QueueConfig(object["arn"]);
    event.addFilterPrefix(object["prefix"]);
    event.addEvent(Minio.ObjectCreatedAll);

    bucketNotification.add(event);
  }

  return await minioClient.setBucketNotification(
    bucketName,
    bucketNotification
  );
}

function _validateBucketName(bucketName: string) {
  // Check if the bucket name contains uppercase letters or underscores
  if (/[A-Z_]/.test(bucketName)) {
    return false;
  }

  // General regex for allowed characters, length, and adjacent periods or hyphens
  const generalRegex = /^(?!xn--)[a-z0-9]([a-z0-9.-]{1,61}[a-z0-9])?$/;

  // Check general pattern
  if (!generalRegex.test(bucketName)) {
    return false;
  }

  // Additional validations
  // 1. Ensure no adjacent periods or period-hyphen adjacency
  if (
    bucketName.includes("..") ||
    bucketName.includes(".-") ||
    bucketName.includes("-.")
  ) {
    return false;
  }

  // 2. Ensure not an IP address
  const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(bucketName)) {
    return false;
  }

  // 3. Ensure it doesn't end with `-s3alias`
  if (bucketName.endsWith("-s3alias")) {
    return false;
  }

  // All validations passed
  return true;
}

export {
  bucketExists,
  createBucket,
  deleteBucket,
  setBucketKafkaNotifications,
  putObject,
  deleteObject,
};