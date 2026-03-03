import { Kafka } from "kafkajs";
import * as messageHandler from "./handlers/storage";
import { logger } from "../lib/logger";
import { buildDlqBody } from "../lib/pipeline-error";
import { resolveKafkaMessagePayload } from "../lib/dlq";
import * as messageTrackingService from "../services/message.tracking.service";

export const start = async () => {
  try {
    const kafka = new Kafka({
      clientId: "openldr-storage",
      brokers: ["openldr-kafka1:19092"],
    });
    const producer = kafka.producer();
    await producer.connect();

    const consumer = kafka.consumer({ groupId: "openldr-storage-consumer" });
    await consumer.connect();
    await consumer.subscribe({ topic: "mapped-inbound", fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const result = await messageHandler.handleMessage({
            topic,
            partition,
            offset: message.offset,
            value: message.value?.toString(),
            key: message.key?.toString(),
          });

          if (result?.projectId && result?.objectName) {
            const processedKey = `${result.projectId}/${result.objectName}`;

            await producer.send({
              topic: "processed-inbound",
              messages: [
                {
                  key: Buffer.from(processedKey),
                  value: JSON.stringify({
                    EventName: "internal:processed",
                    Key: processedKey,
                    processed_object: {
                      bucket_name: result.projectId,
                      object_name: result.objectName,
                    },
                    plugin_selection: result.pluginSelection || null,
                  }),
                },
              ],
            });
          }
        } catch (err: any) {
          logger.error(
            { err, topic, partition },
            "Message failed — routing to DLQ",
          );
          const { resolvedPayload, resolvedPayloadError } =
            await resolveKafkaMessagePayload(message);
          const dlqBody = buildDlqBody({
            topic,
            partition,
            message,
            error: err,
            resolvedPayload,
            resolvedPayloadError,
            pluginSelection:
              resolvedPayload?._plugin_selection ||
              err?.details?.plugin_selection ||
              null,
          });

          let trackingMessageId: string | null = null;
          let trackingObjectPath: string | null = null;
          try {
            const kafkaValue = JSON.parse(message.value?.toString() || "{}");
            const tracking =
              messageTrackingService.extractTrackingContextFromKafkaValue(
                kafkaValue,
              );
            trackingMessageId = tracking.messageId;
            trackingObjectPath = tracking.objectPath;
          } catch (_error) {
            // ignore tracking metadata extraction failure
          }

          await messageTrackingService.safeMarkStageFailed({
            messageId: trackingMessageId as any,
            stage: "storage" as any,
            errorCode: err.code || err.name || "UNHANDLED_STAGE_ERROR",
            errorMessage: err.message || "Unhandled stage error",
            errorDetails: {
              topic,
              partition,
              offset: message.offset,
              stack: err.stack || null,
              dlq_error_id: dlqBody.dlq.error.error_id,
            },
            topic,
            objectPath: trackingObjectPath,
          });

          await producer.send({
            topic: `${topic}-dead-letter`,
            messages: [
              {
                key: message.key,
                value: JSON.stringify(dlqBody),
                headers: {
                  ...message.headers,
                  "x-dlq-error": err.message,
                  "x-dlq-topic": topic,
                  "x-dlq-timestamp": new Date().toISOString(),
                  "x-dlq-error-id": dlqBody.dlq.error.error_id,
                },
              },
            ],
          });
        }
      },
    });

    logger.info("Storage service running and consuming messages");
  } catch (err: any) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Storage service initialization failed",
    );
  }
};
