// mapper.ts
import { Kafka } from "kafkajs";
import * as messageHandler from "./handlers/mapper";
import { logger } from "../lib/logger";

export const start = async () => {
  try {
    const kafka = new Kafka({
      clientId: "openldr-mapper",
      brokers: ["openldr-kafka1:19092"],
    });

    const consumer = kafka.consumer({ groupId: "openldr-mapper-consumer" });

    await consumer.connect();
    await consumer.subscribe({
      topic: "validated-inbound",
      fromBeginning: true,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messageHandler.handleMessage({
          topic,
          partition,
          offset: message.offset,
          value: message.value?.toString(),
          key: message.key?.toString(),
        });
      },
    });

    logger.info("Mapper service running and consuming messages");
  } catch (err: any) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Mapper service initialization failed",
    );
  }
};
