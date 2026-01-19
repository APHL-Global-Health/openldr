import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { services, docker } from "@repo/openldr-core";

let mcCmd: string;
let scriptDir: string;
let infraRoot: string;
let microservicesEnv: string;
let minioContainerName = "openldr-minio";
let minioContainer: any | null;
let useLocalMc = false;

const setupMinIOClient = async (): Promise<void> => {
  // Check if we're running inside the MinIO container
  if (await services.fileExists("/usr/bin/mc")) {
    console.log("Running inside MinIO container, using local mc client");
    useLocalMc = true;
  } else {
    console.log(
      "Running outside MinIO container, using Docker to execute commands"
    );

    // Find the MinIO container
    const containers = await docker.listContainers();
    const minioContainerInfo = containers.find((container: any) =>
      container.Names.some((name: any) => name.includes(minioContainerName))
    );

    if (!minioContainerInfo) {
      throw new Error(
        `MinIO container (${minioContainerName}) is not running.`
      );
    }

    minioContainer = docker.getContainer(minioContainerInfo.Id);
    useLocalMc = false;
  }
};

const waitForMinIOReady = async (maxAttempts = 30): Promise<void> => {
  console.log("Waiting for MinIO to be ready");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `Attempt ${attempt}/${maxAttempts}: Waiting 5 seconds before checking MinIO`
    );

    await services.sleep(5000);

    try {
      await executeMinIOCommand(["admin", "info", "myminio"]);
      console.log("MinIO is ready!");
      await services.sleep(1000 * 10);
      return;
    } catch (error) {
      console.log("MinIO not ready yet");
    }
  }

  throw new Error(`Failed to connect to MinIO after ${maxAttempts} attempts`);
};

const configureMinIOAlias = async (): Promise<void> => {
  console.log("Configuring MinIO client alias");

  // const minioHost = "localhost";
  // console.log(`Using URL: http://${minioHost}:${process.env.MINIO_API_PORT}`);

  let minioUrl: string;
  if (!useLocalMc) {
    console.log("Using container's internal network for MinIO connection");
    minioUrl = "http://openldr-minio:9000";
  } else {
    console.log("Using external network for MinIO connection");
    minioUrl = `https://127.0.0.1/minio`;
  }

  console.log(`Using URL: ${minioUrl}`);

  await executeMinIOCommand([
    "alias",
    "set",
    "myminio",
    minioUrl,
    process.env.MINIO_ROOT_USER!,
    process.env.MINIO_ROOT_PASSWORD!,
  ]);
};

const createPolicies = async (): Promise<void> => {
  console.log("Creating policies for microservices");

  const policies = [
    "bucket-delete-object-delete-policy",
    "bucket-control-policy",
    "object-control-policy",
  ];

  for (const policy of policies) {
    try {
      await executeMinIOCommand([
        "admin",
        "policy",
        "create",
        "myminio",
        policy,
        `/opt/config/${policy}.json`,
      ]);
      console.log(`Successfully created ${policy}`);
    } catch (error: any) {
      console.log(`Error creating ${policy}: ${error.message}`);
    }
  }

  console.log("All policies created.");
};

const createUsersAndAttachPolicies = async (dir: string): Promise<void> => {
  console.log("Creating access keys for microservices and attaching policies");

  const minio_services = [
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

  for (const service of minio_services) {
    const secretKey = crypto.randomBytes(32).toString("base64");

    await createUser(service.name, secretKey);

    for (const policy of service.policies) {
      await attachPolicy(service.name, policy);
    }

    await services.updateEnvFile(
      dir,
      `${service.key}_MINIO_ACCESS_KEY`,
      service.name
    );
    await services.updateEnvFile(
      dir,
      `${service.key}_MINIO_SECRET_KEY`,
      secretKey
    );
  }
};

const createUser = async (
  username: string,
  secretKey: string,
  maxAttempts = 5
): Promise<void> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Attempt ${attempt}/${maxAttempts}: Creating user ${username}`);

    try {
      // Check if user exists
      const userList = await executeMinIOCommand([
        "admin",
        "user",
        "list",
        "myminio",
      ]);
      if (userList.includes(username)) {
        console.log(`User ${username} exists, removing it first`);
        await executeMinIOCommand([
          "admin",
          "user",
          "remove",
          "myminio",
          username,
        ]);
      } else {
        console.log(
          `User ${username} does not exist, proceeding with creation`
        );
      }

      // Create new user
      await executeMinIOCommand([
        "admin",
        "user",
        "add",
        "myminio",
        username,
        secretKey,
      ]);
      console.log(`Successfully created user ${username}`);
      return;
    } catch (error) {
      console.log(`Failed attempt ${attempt}. Retrying`);
      await services.sleep(5000);
    }
  }

  throw new Error(
    `Failed to create user ${username} after ${maxAttempts} attempts`
  );
};

const attachPolicy = async (
  username: string,
  policy: string,
  maxAttempts = 5
): Promise<void> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await executeMinIOCommand([
        "admin",
        "policy",
        "attach",
        "myminio",
        policy,
        "--user",
        username,
      ]);
      return;
    } catch (error) {
      console.log(`Failed attempt ${attempt}. Retrying`);
      await services.sleep(5000);
    }
  }

  throw new Error(
    `Failed to attach policy to user ${username} after ${maxAttempts} attempts`
  );
};

const configureKafkaNotifications = async (): Promise<void> => {
  console.log("Configuring MinIO Kafka notifications");

  const notifications = [
    { id: "raw-kafka-notification", topic: "raw-inbound" },
    { id: "validated-kafka-notification", topic: "validated-inbound" },
    { id: "mapped-kafka-notification", topic: "mapped-inbound" },
    { id: "processed-kafka-notification", topic: "processed-inbound" },
  ];

  for (const notification of notifications) {
    await configureKafkaNotification(notification.id, notification.topic);
  }
};

const configureKafkaNotification = async (
  notificationId: string,
  topic: string,
  maxAttempts = 5
): Promise<void> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `Attempt ${attempt}/${maxAttempts}: Configuring Kafka notification for ${topic}`
    );

    try {
      await executeMinIOCommand([
        "admin",
        "config",
        "set",
        "myminio",
        `notify_kafka:${notificationId}`,
        "brokers=openldr-kafka1:19092",
        `topic=${topic}`,
        "version=0.10.2.0",
      ]);
      console.log(`Successfully configured Kafka notification for ${topic}`);
      return;
    } catch (error) {
      console.log(`Failed attempt ${attempt}. Retrying`);
      await services.sleep(5000);
    }
  }

  throw new Error(
    `Failed to configure Kafka notification for ${topic} after ${maxAttempts} attempts`
  );
};

const restartMinIOContainer = async (dir: string): Promise<void> => {
  console.log("Restarting MinIO container to apply notification settings");

  try {
    if (minioContainer) {
      await minioContainer.restart();
    } else {
      // Fallback: find container by name
      const containers = await docker.listContainers();
      const minioContainerInfo = containers.find((container: any) =>
        container.Names.some((name: any) => name.includes("openldr-minio"))
      );

      if (minioContainerInfo) {
        const container = docker.getContainer(minioContainerInfo.Id);
        await container.restart();
      } else {
        throw new Error("MinIO container not found");
      }
    }
  } catch (error) {
    console.log("Fallback to docker compose restart");

    const infraRootEnv = path.resolve(dir, "..", "..", ".env.infrastructure");
    if (!(await services.fileExists(infraRootEnv))) {
      throw new Error(
        `Could not find infrastructure environment file at ${infraRootEnv}`
      );
    }
    execSync(
      `docker compose --env-file "${infraRootEnv}" -f "${dir}/docker-compose.yml" restart minio`
    );
  }
};

const createPluginsBucket = async (): Promise<void> => {
  console.log("Creating plugins bucket");

  try {
    await executeMinIOCommand(["mb", "myminio/plugins", "--ignore-existing"]);
    console.log("Successfully created/verified plugins bucket");
  } catch (error: any) {
    console.log(`Error creating plugins bucket:  ${error.message}`);
  }
};

const uploadTestPlugins = async (): Promise<void> => {
  console.log("Uploading test plugin files");

  const plugins = [
    {
      file: "schema-validation-hl7.js",
      id: process.env.TEST_PLUGIN_SCHEMA_ID,
      name: "schema",
    },
    {
      file: "terminology-mapping-zlab.json",
      id: process.env.TEST_PLUGIN_MAPPER_ID,
      name: "mapper",
    },
    {
      file: "recipient-lab-data.js",
      id: process.env.TEST_PLUGIN_RECIPIENT_ID,
      name: "recipient",
    },
    {
      file: "recipient-manual-entry-lab-data.js",
      id: process.env.TEST_PLUGIN_RECIPIENT_MANUAL_ENTRY_ID,
      name: "manual entry recipient",
    },
  ];

  for (const plugin of plugins) {
    try {
      // Check if file exists in container
      await executeDockerCommand([
        "ls",
        "-l",
        `/opt/config/test-files/${plugin.file}`,
      ]);
      console.log(`Found ${plugin.name} plugin file in container`);

      // Upload file using mc cp
      await executeMinIOCommand([
        "cp",
        `/opt/config/test-files/${plugin.file}`,
        `myminio/plugins/${plugin.id}/`,
      ]);
      console.log(`Successfully uploaded test ${plugin.name} plugin`);
    } catch (error: any) {
      console.log(
        `Error uploading test ${plugin.name} plugin: ${error.message}`
      );
    }
  }
};

const createDefaultBuckets = async (): Promise<void> => {
  const facilities = [
    {
      id: process.env.DEFAULT_MANUAL_ENTRY_FACILITY_ID,
      name: "DEFAULT_MANUAL_ENTRY_FACILITY",
    },
    { id: process.env.TEST_FACILITY_ID, name: "TEST_FACILITY" },
  ];

  for (const facility of facilities) {
    if (!facility.id) {
      console.log(`Warning: ${facility.name}_ID is not set in .env file`);
      continue;
    }

    console.log(`Creating ${facility.name.toLowerCase()} bucket`);
    const bucketName = facility.id.toLowerCase().replace(/_/g, "-");

    try {
      await executeMinIOCommand([
        "mb",
        `myminio/${bucketName}`,
        "--ignore-existing",
      ]);
      console.log(`Successfully created/verified bucket ${bucketName}`);

      await setupBucketNotifications(bucketName);
    } catch (error: any) {
      console.log(`Error creating bucket ${bucketName}: ${error.message}`);
    }
  }
};

const setupBucketNotifications = async (bucketName: string): Promise<void> => {
  console.log("Setting up event notifications");

  const notifications = [
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

  for (const notification of notifications) {
    try {
      await executeMinIOCommand([
        "event",
        "add",
        `myminio/${bucketName}/${notification.prefix}`,
        notification.arn,
        "--event",
        "put",
        "--prefix",
        notification.prefix,
      ]);
    } catch (error: any) {
      console.log(
        `Error setting up notification for ${notification.prefix}: ${error.message}`
      );
    }
  }
};

const finalRestart = async (dir: string): Promise<void> => {
  console.log("Restarting MinIO container to apply bucket settings");
  await restartMinIOContainer(dir);
};

// Utility methods
const executeMinIOCommand = async (args: string[]): Promise<string> => {
  if (useLocalMc) {
    // Execute locally
    return executeCommand("mc", args);
  } else {
    // Execute in container using dockerode
    if (!minioContainer) {
      throw new Error("MinIO container not initialized");
    }
    return executeDockerCommand(["mc", ...args]);
  }
};

const executeDockerCommand = async (args: string[]): Promise<string> => {
  if (!minioContainer) {
    throw new Error("MinIO container not initialized");
  }

  const exec = await minioContainer.exec({
    Cmd: args,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ Detach: false });

  return new Promise<string>((resolve, reject) => {
    let output = "";
    stream.on("data", (chunk: any) => (output += chunk.toString()));
    stream.on("end", () => resolve(output.trim()));
    stream.on("error", reject);
  });
};

const executeCommand = async (
  command: string,
  args: string[]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const fullCommand = `${command} ${args.join(" ")}`;
      const result = execSync(fullCommand, { encoding: "utf-8" });
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
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

    const microservicesEnv = path.resolve(
      dir,
      "..",
      "..",
      ".env.microservices"
    );
    if (!(await services.fileExists(microservicesEnv))) {
      throw new Error(
        `Could not find microservices environment file at ${microservicesEnv}`
      );
    }

    await services.waitForContainerHealth("openldr-minio", 120000, docker);

    await setupMinIOClient();
    await configureMinIOAlias();
    await createPolicies();
    await createUsersAndAttachPolicies(microservicesEnv);
    await configureKafkaNotifications();

    await restartMinIOContainer(dir);
    await services.waitForContainerHealth("openldr-minio", 120000, docker);

    await createPluginsBucket();
    if (
      process.env.INCLUDE_TEST_DATA &&
      process.env.INCLUDE_TEST_DATA.toLowerCase().trim() == "true"
    ) {
      await uploadTestPlugins();
      await createDefaultBuckets();
    }

    await finalRestart(dir);
    await services.waitForContainerHealth("openldr-minio", 120000, docker);

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
