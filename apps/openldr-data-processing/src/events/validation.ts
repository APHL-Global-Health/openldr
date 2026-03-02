import { Kafka } from "kafkajs";
import * as messageHandler from "./handlers/validation";
import { logger } from "../lib/logger";

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
