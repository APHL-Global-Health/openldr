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

const deleteOpenSearchSinkConnector = async () => {
  const kafkaConnectUrl = `https://${process.env.HOST_IP}:${process.env.GATEWAY_HTTPS_PORT}/kafka-connect`;

  console.log("Deleting OpenSearch sink connector");

  const res = await fetch(`${kafkaConnectUrl}/connectors/opensearch-sink`, {
    method: "DELETE",
  });

  if (res.ok || res.status === 404) {
    console.log("OpenSearch sink connector deleted (or did not exist).");
  } else {
    const text = await res.text();
    console.error(
      "Failed to delete OpenSearch sink connector. Response:",
      text,
    );
  }
};

const setup = async (dir: string) => {
  console.log(`Running setup - ${dir}`);
  // Do nothing for now, as the connector is being pulled and configured in the start script.
  // We can add any additional setup steps here in the future if needed.
};

const reset = async (dir: string) => {
  console.log(`Running reset - ${dir}`);

  try {
    services.loadEnv(path.resolve(".env"));

    await services.waitForContainerHealth(
      process.env.KAFKA_CONNECT_HOSTNAME || "openldr-kafka-connect",
      120000,
      docker,
    );

    await deleteOpenSearchSinkConnector();
    await createOpenSearchSinkConnector();

    console.log("Kafka reset complete!");
  } catch (error) {
    console.log(`Reset failed: ${error}`);
    process.exit(1);
  }
};

const stop = async (dir: string) => {
  console.log(`Stopping services - ${dir}`);

  try {
    services.loadEnv(path.resolve(".env"));
    await deleteOpenSearchSinkConnector();
    console.log("Kafka stop complete!");
  } catch (error) {
    console.log(`Stop failed: ${error}`);
    process.exit(1);
  }
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
