import kafka from "kafka-node";
import { DynamicModelManager } from "@openldr/internal-database";
import * as messageHandler from "./messageHandler";

const consumerOptions: any = {
  kafkaHost: "openldr-kafka1:19092",
  groupId: "openldr-external-storage-consumer",
  fromOffset: "earliest",
};

// this is the kafka topic that the external storage service subscribed to as defined in minio
const consumerGroup = new kafka.ConsumerGroup(
  consumerOptions,
  "mapped-inbound"
);

// Initialize database and start Kafka consumer
(async () => {
  try {
    const modelManager = await DynamicModelManager.create(
      process.env.INTERNAL_DB_PREFERRED_DIALET
    );

    // Set up Kafka consumer
    consumerGroup.on("message", function (kafkaMessage) {
      messageHandler.handleMessage(kafkaMessage);
    });

    consumerGroup.on("error", function (err) {
      console.log("Error consuming kafka message:", err);
    });

    console.log(
      "OpenLDR External Storage service running and consuming messages..."
    );
  } catch (error) {
    console.error("Service initialization failed:", error);
    process.exit(1);
  }
})();
