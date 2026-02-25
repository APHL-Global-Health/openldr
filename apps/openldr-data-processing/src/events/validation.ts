import kafka from "kafka-node";
import * as messageHandler from "./handlers/validation";
import { logger } from "../lib/logger";

export const start = () => {
  try {
    const consumerOptions: any = {
      kafkaHost: "openldr-kafka1:19092",
      groupId: "openldr-validation-consumer",
      fromOffset: "earliest",
    };

    // this is the kafka topic that the validation service subscribed to as defined in minio
    const consumerGroup = new kafka.ConsumerGroup(
      consumerOptions,
      "raw-inbound",
    );

    // Set up Kafka consumer
    consumerGroup.on("message", function (kafkaMessage) {
      messageHandler.handleMessage(kafkaMessage);
    });

    consumerGroup.on("error", function (err) {
      logger.error(
        { error: err.message, stack: err.stack },
        "Validation: Error consuming kafka message",
      );
    });

    logger.info("Validation service running and consuming messages");
  } catch (err: any) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Validation service initialization failed",
    );
  }
};
