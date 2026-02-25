import path from "path";
import { services, docker } from "@repo/openldr-core";

// Create OpenSearch sink connector
const createOpenSearchSinkConnector = async () => {
  const kafkaConnectUrl = `https://${process.env.HOST_IP}:${process.env.GATEWAY_HTTPS_PORT}/kafka-connect`;
  const opensearchUrl = `http://openldr-opensearch:${process.env.OPENSEARCH_PORT}`;

  console.log("Creating OpenSearch sink connector and message-metadata index");
  console.log(`Using kafka connect connection URL: ${kafkaConnectUrl}`);
  console.log(`Using OpenSearch connection URL: ${opensearchUrl}`);

  const payload = {
    name: "opensearch-sink",
    config: {
      "connector.class":
        "io.aiven.kafka.connect.opensearch.OpensearchSinkConnector",
      "tasks.max": "4",
      topics:
        "raw-inbound, validated-inbound, mapped-inbound, processed-inbound, errors-notifications",
      "key.converter": "org.apache.kafka.connect.storage.StringConverter",
      "connection.url": opensearchUrl,
      "connection.username": "admin",
      "connection.password": process.env.OPENSEARCH_INITIAL_ADMIN_PASSWORD,
      "type.name": "kafka-connect",
      "schema.ignore": "true",
      "value.converter": "org.apache.kafka.connect.json.JsonConverter",
      "value.converter.schemas.enable": "false",
      "behavior.on.malformed.documents": "warn",
      "errors.tolerance": "all",
      "errors.deadletterqueue.topic.name": "deadletterqueue-error-log",
      "errors.deadletterqueue.context.headers.enable": true,
      "errors.deadletterqueue.topic.replication.factor": 1,
      "topic.creation.default.replication.factor": 1,
    },
  };

  const res = await fetch(`${kafkaConnectUrl}/connectors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (text.includes("opensearch-sink")) {
    console.log("OpenSearch sink connector created successfully!");
  } else {
    console.error(
      "Failed to create OpenSearch sink connector. Response:",
      text,
    );
  }

  // Verify connector status
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const statusRes = await fetch(
    `${kafkaConnectUrl}/connectors/opensearch-sink/status`,
  );
  const statusText = await statusRes.text();
  console.log("INFO", `Connector status: ${statusText}`);
};

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
    services.loadEnv(path.resolve(".env"));

    await services.waitForContainerHealth(
      process.env.KAFKA_CONNECT_HOSTNAME || "openldr-kafka-connect",
      120000,
      docker,
    );

    await createOpenSearchSinkConnector();

    console.log("Kafka initialization script complete!");
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
