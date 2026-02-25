import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { services, MinioDocker } from "@repo/openldr-core";

import type {
  MinioService,
  MinioPlugin,
  MinioBucket,
  MinioEvent,
  KafkaNotification,
} from "@repo/openldr-core/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const minio_services: MinioService[] = [
  {
    name: "data-processing-service",
    policies: ["object-control-policy"],
    key: "DATA_PROCESSING",
  },
  {
    name: "validation-service",
    policies: ["object-control-policy"],
    key: " VALIDATION",
  },
  {
    name: "mapper-service",
    policies: ["object-control-policy"],
    key: "MAPPER",
  },
  {
    name: "external-storage-service",
    policies: ["object-control-policy"],
    key: "EXTERNAL_STORAGE",
  },
  {
    name: "entity-services-service",
    policies: [
      "object-control-policy",
      "bucket-control-policy",
      "bucket-delete-object-delete-policy",
    ],
    key: "ENTITY_SERVICES",
  },
  {
    name: "plugin-service",
    policies: [
      "object-control-policy",
      "bucket-control-policy",
      "bucket-delete-object-delete-policy",
    ],
    key: "PLUGIN",
  },
];

const notifications: KafkaNotification[] = [
  { id: "raw-kafka-notification", topic: "raw-inbound" },
  { id: "validated-kafka-notification", topic: "validated-inbound" },
  { id: "mapped-kafka-notification", topic: "mapped-inbound" },
  { id: "processed-kafka-notification", topic: "processed-inbound" },
];

const plugins: MinioPlugin[] = [
  {
    file: "schema-validation-hl7.js",
    id: process.env.TEST_PLUGIN_SCHEMA_ID!,
    name: "schema",
  },
  {
    file: "terminology-mapping-zlab.json",
    id: process.env.TEST_PLUGIN_MAPPER_ID!,
    name: "mapper",
  },
  {
    file: "recipient-lab-data.js",
    id: process.env.TEST_PLUGIN_RECIPIENT_ID!,
    name: "recipient",
  },
  {
    file: "recipient-manual-entry-lab-data.js",
    id: process.env.TEST_PLUGIN_RECIPIENT_MANUAL_ENTRY_ID!,
    name: "manual entry recipient",
  },
];

const buckets: MinioBucket[] = [
  {
    id: process.env.DEFAULT_MANUAL_ENTRY_FACILITY_ID!,
    name: "DEFAULT_MANUAL_ENTRY_FACILITY",
  },
  { id: process.env.TEST_FACILITY_ID!, name: "TEST_FACILITY" },
];

const events: MinioEvent[] = [
  { prefix: "raw/", arn: "arn:minio:sqs::raw-kafka-notification:kafka" },
  {
    prefix: "validated/",
    arn: "arn:minio:sqs::validated-kafka-notification:kafka",
  },
  {
    prefix: "mapped/",
    arn: "arn:minio:sqs::mapped-kafka-notification:kafka",
  },
  {
    prefix: "processed/",
    arn: "arn:minio:sqs::processed-kafka-notification:kafka",
  },
];

const minio = new MinioDocker(
  "openldr-minio",
  process.env.MINIO_ROOT_USER!,
  process.env.MINIO_ROOT_PASSWORD!,
);

const setup = async (dir: string) => {
  console.log(`Running setup - ${dir}`);
};

const reset = async (dir: string) => {
  console.log(`Running reset - ${dir}`);
};

const stop = async (dir: string) => {
  console.log(`Stopping services - ${dir}`);
};

const start = async (dir: string) => {
  console.log(`Starting services - ${dir}`);

  try {
    const env = path.resolve(dir, ".env");
    if (!(await services.fileExists(env))) {
      throw new Error(
        `Could not find microservices environment file at ${env}`,
      );
    }

    await minio.waitForContainerHealth(120000);

    await minio.setupMinIOClient();
    await minio.configureMinIOAlias();
    await minio.createPolicies();
    await minio.createUsersAndAttachPolicies(env, minio_services);
    await minio.configureKafkaNotifications(notifications);

    await minio.restartMinIOContainer(dir);
    await minio.waitForContainerHealth(120000);
    await minio.createPluginsBucket();

    if (
      process.env.INCLUDE_TEST_DATA &&
      process.env.INCLUDE_TEST_DATA.toLowerCase().trim() == "true"
    ) {
      await minio.uploadPlugins(plugins);
      await minio.createBuckets(buckets, events);
    }

    await minio.createPluginsBucket();
    await minio.waitForContainerHealth(120000);

    console.log("Minio initialization complete`");
  } catch (error) {
    await console.log(`Init failed: ${error}`);
    process.exit(1);
  }
};

const { command, dir } = services.processArguments(__dirname, process.argv);
switch (command) {
  case "setup":
    setup(dir);
    break;
  case "reset":
    reset(dir);
    break;
  case "stop":
    stop(dir);
    break;
  case "start":
    start(dir);
    break;
  default:
    throw new Error(`Unknown command: ${command} - ${dir}`);
}
