import { Kafka, type Consumer, type Admin, type KafkaMessage } from "kafkajs";

const ENV = process.env;
const IsDev = ENV.MODE === "development";

interface KafkaConfig {
  brokers: string[];
  clientId: string;
}

class KafkaManager {
  private kafka: Kafka;
  private admin: Admin | null = null;
  private consumers: Map<string, Consumer> = new Map();

  constructor(config: KafkaConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
    });
  }

  async connectAdmin(): Promise<void> {
    if (this.admin) return;

    this.admin = this.kafka.admin();
    await this.admin.connect();
    console.log("Kafka Admin connected");
  }

  async getTopicOffsets(
    topic: string,
  ): Promise<
    { partition: number; offset: string; high: string; low: string }[]
  > {
    if (!this.admin) throw new Error("Admin not connected");

    const offsets = await this.admin.fetchTopicOffsets(topic);
    return offsets;
  }

  async listTopics(): Promise<string[]> {
    if (!this.admin) throw new Error("Admin not connected");
    return this.admin.listTopics();
  }

  async fetchMessages(
    topic: string,
    options: {
      limit?: number;
      fromBeginning?: boolean;
      startTime?: Date;
      timeout?: number;
    } = {},
  ): Promise<KafkaMessage[]> {
    // Generate unique consumer group ID for each call
    const consumer = this.kafka.consumer({
      groupId: `mcp-reader-${topic}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionTimeout: 10000,
      heartbeatInterval: 3000,
    });

    try {
      await consumer.connect();
      await consumer.subscribe({
        topic,
        fromBeginning: options.fromBeginning ?? false,
      });

      const messages: KafkaMessage[] = [];
      const limit = options.limit ?? 10;
      const timeout = options.timeout ?? 4000;

      return new Promise((resolve, reject) => {
        let resolved = false;

        const timer = setTimeout(async () => {
          if (!resolved) {
            resolved = true;
            try {
              await consumer.stop();
              await consumer.disconnect();
            } catch (e) {
              // Ignore disconnect errors
            }
            resolve(messages);
          }
        }, timeout);

        consumer
          .run({
            eachMessage: async ({ message }) => {
              if (resolved) return;

              // Filter by timestamp if provided
              if (options.startTime && message.timestamp) {
                const msgTime = new Date(parseInt(message.timestamp));
                if (msgTime < options.startTime) return;
              }

              messages.push(message);

              if (messages.length >= limit && !resolved) {
                resolved = true;
                clearTimeout(timer);
                try {
                  await consumer.stop();
                  await consumer.disconnect();
                } catch (e) {
                  // Ignore disconnect errors
                }
                resolve(messages);
              }
            },
          })
          .catch(async (err) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              try {
                await consumer.stop();
                await consumer.disconnect();
              } catch (e) {
                // Ignore disconnect errors
              }
              reject(err);
            }
          });
      });
    } catch (error) {
      try {
        await consumer.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.admin) {
      await this.admin.disconnect();
      console.log("Kafka Admin disconnected");
    }

    for (const [groupId, consumer] of this.consumers) {
      await consumer.disconnect();
      console.log(`Consumer ${groupId} disconnected`);
    }
    this.consumers.clear();
  }
}

let kafkaManager: KafkaManager | null = null;

export function getKafkaManager(): KafkaManager {
  if (!kafkaManager) {
    const brokers = IsDev
      ? [process.env.KAFKA_BROKERS || "localhost:29092"]
      : [`${process.env.KAFKA_HOSTNAME}:19092`];

    kafkaManager = new KafkaManager({
      brokers,
      clientId: process.env.MCP_SERVER_HOSTNAME || "openldr-mcp-server",
    });
  }
  return kafkaManager;
}

export async function disconnectKafka(): Promise<void> {
  if (kafkaManager) {
    await kafkaManager.disconnect();
  }
}
