import { Kafka } from "kafkajs";
import { logger } from "../lib/logger";
import * as messageTrackingService from "./message.tracking.service";
import * as minioService from "./minio.service";

const kafka = new Kafka({
  clientId: "openldr-dlq-replay",
  brokers: [process.env.KAFKA_BROKER || "openldr-kafka1:19092"],
});

const STAGE_TO_TOPIC: Record<string, string> = {
  validation: "raw-inbound",
  mapping: "validated-inbound",
  storage: "mapped-inbound",
  outpost: "processed-inbound",
};

// Map stage to the run field that holds its input object path
const STAGE_TO_PATH_FIELD: Record<string, string> = {
  validation: "rawObjectPath",
  mapping: "validatedObjectPath",
  storage: "mappedObjectPath",
  outpost: "processedObjectPath",
};

export async function replayFromDlq(messageId: string): Promise<{
  success: boolean;
  sourceTopic: string;
  replayedAt: string;
}> {
  const run = await messageTrackingService.getRunByMessageId(messageId);
  if (!run) throw new Error(`Run not found: ${messageId}`);
  if (run.currentStatus !== "failed") {
    throw new Error(`Run is not in failed status (current: ${run.currentStatus})`);
  }

  const errorStage = run.errorStage;
  if (!errorStage || !STAGE_TO_TOPIC[errorStage]) {
    throw new Error(`Unknown or missing error stage: ${errorStage}`);
  }

  const sourceTopic = STAGE_TO_TOPIC[errorStage];
  const pathField = STAGE_TO_PATH_FIELD[errorStage];
  const objectPath: string | null = run[pathField] || null;

  if (!objectPath) {
    throw new Error(`No object path for stage "${errorStage}" (field: ${pathField})`);
  }

  // Split "bucket/key" format
  const slashIdx = objectPath.indexOf("/");
  if (slashIdx < 0) {
    throw new Error(`Invalid object path format: ${objectPath}`);
  }
  const bucketName = objectPath.substring(0, slashIdx);
  const objectName = objectPath.substring(slashIdx + 1);

  // Verify object still exists
  try {
    await minioService.statObject({ bucketName, objectName });
  } catch {
    throw new Error(`MinIO object no longer exists: ${objectPath}`);
  }

  // Reconstruct MinIO S3 notification event
  const kafkaKey = `${bucketName}/${objectName}`;
  const notificationEvent = {
    Records: [
      {
        s3: {
          bucket: { name: bucketName },
          object: {
            key: encodeURIComponent(objectName),
            userMetadata: {
              "X-Amz-Meta-Messageid": run.messageId,
              "X-Amz-Meta-Userid": run.userId || "",
              "X-Amz-Meta-Messagecontenttype": "application/json",
            },
          },
        },
      },
    ],
  };

  const producer = kafka.producer();
  await producer.connect();

  try {
    await producer.send({
      topic: sourceTopic,
      messages: [
        {
          key: kafkaKey,
          value: JSON.stringify(notificationEvent),
        },
      ],
    });
  } finally {
    await producer.disconnect();
  }

  // Reset run status for re-processing
  await messageTrackingService.resetRunForRetry(messageId, errorStage);

  const replayedAt = new Date().toISOString();
  logger.info(
    { messageId, errorStage, sourceTopic, objectPath, replayedAt },
    "DLQ replay: message re-published to source topic",
  );

  return { success: true, sourceTopic, replayedAt };
}
