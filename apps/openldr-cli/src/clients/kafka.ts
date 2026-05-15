import { Kafka, type Admin, type Consumer, type Producer, logLevel } from "kafkajs";
import type { LoadedConfig } from "../config.js";
import { CliError } from "../errors.js";

let kafka: Kafka | undefined;
let admin: Admin | undefined;

function getKafka(cfg: LoadedConfig): Kafka {
  if (kafka) return kafka;
  kafka = new Kafka({
    clientId: cfg.kafka.clientId,
    brokers: cfg.kafka.brokers,
    logLevel: logLevel.NOTHING,
    connectionTimeout: 5_000,
    requestTimeout: 15_000,
  });
  return kafka;
}

export async function getAdmin(cfg: LoadedConfig): Promise<Admin> {
  if (admin) return admin;
  const k = getKafka(cfg);
  admin = k.admin();
  try {
    await admin.connect();
  } catch (err) {
    admin = undefined;
    throw new CliError(
      "QUEUE_CONNECT_FAILED",
      `Kafka admin connect failed: ${err instanceof Error ? err.message : String(err)}`,
      { brokers: cfg.kafka.brokers },
    );
  }
  return admin;
}

export function newConsumer(cfg: LoadedConfig, groupId: string): Consumer {
  return getKafka(cfg).consumer({ groupId, allowAutoTopicCreation: false });
}

export function newProducer(cfg: LoadedConfig): Producer {
  return getKafka(cfg).producer({ allowAutoTopicCreation: false });
}

export async function disconnectAll(): Promise<void> {
  if (admin) {
    try {
      await admin.disconnect();
    } catch {
      // best effort
    }
    admin = undefined;
  }
  kafka = undefined;
}
