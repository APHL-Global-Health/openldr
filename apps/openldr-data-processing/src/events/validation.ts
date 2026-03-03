import { Kafka } from "kafkajs";
import * as messageHandler from "./handlers/validation";
import { logger } from "../lib/logger";
import * as messageTrackingService from "../services/message.tracking.service";

export const start = async () => {
  try {
    const kafka = new Kafka({
      clientId: "openldr-validation",
      brokers: ["openldr-kafka1:19092"],
    });

    const producer = kafka.producer();
    await producer.connect();

    const consumer = kafka.consumer({ groupId: "openldr-validation-consumer" });

    await consumer.connect();
    await consumer.subscribe({ topic: "raw-inbound", fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          await messageHandler.handleMessage({
            topic,
            partition,
            offset: message.offset,
            value: message.value?.toString(),
            key: message.key?.toString(),
          });
        } catch (err: any) {
          logger.error(
            { err, topic, partition },
            "Message failed — routing to DLQ",
          );
          let messageId: string | null = null;
          let objectPath: string | null = null;
          try {
            const kafkaValue = JSON.parse(message.value?.toString() || "{}");
            const tracking = messageTrackingService.extractTrackingContextFromKafkaValue(kafkaValue);
            messageId = tracking.messageId;
            objectPath = tracking.objectPath;
          } catch (_error) {
            // ignore tracking parse failure
          }
          await messageTrackingService.safeMarkStageFailed({
            messageId: messageId as any,
            stage: "validation",
            errorCode: err.code || err.name || "UNHANDLED_STAGE_ERROR",
            errorMessage: err.message || "Unhandled stage error",
            errorDetails: {
              topic,
              partition,
              offset: message.offset,
              stack: err.stack || null,
            },
            topic,
            objectPath,
          });
          await producer.send({
            topic: `${topic}-dead-letter`,
            messages: [
              {
                key: message.key,
                value: message.value,
                headers: {
                  ...message.headers,
                  "x-dlq-error": err.message,
                  "x-dlq-topic": topic,
                  "x-dlq-timestamp": new Date().toISOString(),
                },
              },
            ],
          });
        }
      },
    });

    logger.info("Validation service running and consuming messages");
  } catch (err: any) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Validation service initialization failed",
    );
  }
};
