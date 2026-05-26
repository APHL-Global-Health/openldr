import * as services from "./services";
import { docker } from "./docker";
import { execSync } from "child_process";
import path from "path";
import crypto from "crypto";
import type {
  MinioService,
  MinioPlugin,
  MinioBucket,
  MinioEvent,
  KafkaNotification,
} from "./types";

export class MinioDocker {
  #containerName: string;
  #username: string;
  #password: string;
  #minioContainer: any;
  #useLocalMc: boolean;

  constructor(containerName: string, username: string, password: string) {
    this.#containerName = containerName;
    this.#username = username;
    this.#password = password;
    this.#minioContainer = null;
    this.#useLocalMc = false;
  }

  waitForContainerHealth = async (timeoutMs: number = 60000): Promise<void> => {
    return services.waitForContainerHealth(
      this.#containerName,
      timeoutMs,
      docker,
    );
  };

  setupMinIOClient = async (): Promise<void> => {
    // Check if we're running inside the MinIO container
    if (await services.fileExists("/usr/bin/mc")) {
      console.log("Running inside MinIO container, using local mc client");
      this.#useLocalMc = true;
    } else {
      console.log(
        "Running outside MinIO container, using Docker to execute commands",
      );

      // Find the MinIO container
      const containers = await docker.listContainers();
      const minioContainerInfo = containers.find((container: any) =>
        container.Names.some((name: any) => name.includes(this.#containerName)),
      );

      if (!minioContainerInfo) {
        throw new Error(
          `MinIO container (${this.#containerName}) is not running.`,
        );
      }

      this.#minioContainer = docker.getContainer(minioContainerInfo.Id);
      this.#useLocalMc = false;
    }
  };

  configureMinIOAlias = async (): Promise<void> => {
    console.log("Configuring MinIO client alias");

    // const minioHost = "localhost";
    // console.log(`Using URL: http://${minioHost}:${process.env.MINIO_API_PORT}`);

    let minioUrl: string;
    if (!this.#useLocalMc) {
      console.log("Using container's internal network for MinIO connection");
      minioUrl = "http://openldr-minio:9000";
    } else {
      console.log("Using external network for MinIO connection");
      minioUrl = `https://127.0.0.1/minio`;
    }

    console.log(`Using URL: ${minioUrl}`);

    await this.executeMinIOCommand([
      "alias",
      "set",
      "myminio",
      minioUrl,
      this.#username!,
      this.#password!,
    ]);
  };

  createPolicies = async (): Promise<void> => {
    console.log("Creating policies for microservices");

    const policies = [
      "bucket-delete-object-delete-policy",
      "bucket-control-policy",
      "object-control-policy",
    ];

    for (const policy of policies) {
      try {
        await this.executeMinIOCommand([
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

  createUsersAndAttachPolicies = async (
    dir: string,
    minioServices: MinioService[],
  ): Promise<void> => {
    console.log(
      "Creating access keys for microservices and attaching policies",
    );

    for (const service of minioServices) {
      const secretKey = crypto.randomBytes(32).toString("base64");

      await this.createUser(service.name, secretKey);

      for (const policy of service.policies) {
        await this.attachPolicy(service.name, policy);
      }

      await services.updateEnvFile(
        dir,
        `${service.key}_MINIO_ACCESS_KEY`,
        service.name,
      );
      await services.updateEnvFile(
        dir,
        `${service.key}_MINIO_SECRET_KEY`,
        secretKey,
      );
    }
  };

  createUser = async (
    username: string,
    secretKey: string,
    maxAttempts = 5,
  ): Promise<void> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(
        `Attempt ${attempt}/${maxAttempts}: Creating user ${username}`,
      );

      try {
        // Check if user exists
        const userList = await this.executeMinIOCommand([
          "admin",
          "user",
          "list",
          "myminio",
        ]);
        if (userList.includes(username)) {
          console.log(`User ${username} exists, removing it first`);
          await this.executeMinIOCommand([
            "admin",
            "user",
            "remove",
            "myminio",
            username,
          ]);
        } else {
          console.log(
            `User ${username} does not exist, proceeding with creation`,
          );
        }

        // Create new user
        await this.executeMinIOCommand([
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
      `Failed to create user ${username} after ${maxAttempts} attempts`,
    );
  };

  attachPolicy = async (
    username: string,
    policy: string,
    maxAttempts = 5,
  ): Promise<void> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.executeMinIOCommand([
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
      `Failed to attach policy to user ${username} after ${maxAttempts} attempts`,
    );
  };

  configureKafkaNotifications = async (
    notifications: KafkaNotification[],
  ): Promise<void> => {
    console.log("Configuring MinIO Kafka notifications");

    for (const notification of notifications) {
      await this.configureKafkaNotification(
        notification.id,
        notification.topic,
      );
    }
  };

  configureKafkaNotification = async (
    notificationId: string,
    topic: string,
    maxAttempts = 5,
  ): Promise<void> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(
        `Attempt ${attempt}/${maxAttempts}: Configuring Kafka notification for ${topic}`,
      );

      try {
        await this.executeMinIOCommand([
          "admin",
          "config",
          "set",
          "myminio",
          `notify_kafka:${notificationId}`,
          "brokers=openldr-kafka1:19092",
          `topic=${topic}`,
          "version=0.10.2.0",
          "enable=on",
        ]);
        console.log(`Successfully configured Kafka notification for ${topic}`);
        return;
      } catch (error) {
        console.log(`Failed attempt ${attempt}. Retrying`);
        await services.sleep(5000);
      }
    }

    throw new Error(
      `Failed to configure Kafka notification for ${topic} after ${maxAttempts} attempts`,
    );
  };

  restartMinIOContainer = async (dir: string): Promise<void> => {
    console.log("Restarting MinIO container to apply notification settings");

    try {
      if (this.#minioContainer) {
        await this.#minioContainer.restart();
      } else {
        // Fallback: find container by name
        const containers = await docker.listContainers();
        const minioContainerInfo = containers.find((container: any) =>
          container.Names.some((name: any) => name.includes("openldr-minio")),
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
          `Could not find infrastructure environment file at ${infraRootEnv}`,
        );
      }
      execSync(
        `docker compose --env-file "${infraRootEnv}" -f "${dir}/docker-compose.yml" restart minio`,
      );
    }
  };

  createPluginsBucket = async (): Promise<void> => {
    console.log("Creating plugins bucket");

    try {
      await this.executeMinIOCommand([
        "mb",
        "myminio/plugins",
        "--ignore-existing",
      ]);
      console.log("Successfully created/verified plugins bucket");
    } catch (error: any) {
      console.log(`Error creating plugins bucket:  ${error.message}`);
    }
  };

  uploadPlugins = async (plugins: MinioPlugin[]): Promise<void> => {
    console.log("Uploading test plugin files");

    for (const plugin of plugins) {
      try {
        // Check if file exists in container
        await this.executeDockerCommand([
          "ls",
          "-l",
          `/opt/config/test-files/${plugin.file}`,
        ]);
        console.log(`Found ${plugin.name} plugin file in container`);

        // Upload file using mc cp
        await this.executeMinIOCommand([
          "cp",
          `/opt/config/test-files/${plugin.file}`,
          `myminio/plugins/${plugin.id}/`,
        ]);
        console.log(`Successfully uploaded test ${plugin.name} plugin`);
      } catch (error: any) {
        console.log(
          `Error uploading test ${plugin.name} plugin: ${error.message}`,
        );
      }
    }
  };

  createBuckets = async (
    buckets: MinioBucket[],
    notifications: MinioEvent[],
  ): Promise<void> => {
    for (const bucket of buckets) {
      if (!bucket.id) {
        console.log(`Warning: ${bucket.name}_ID is not set in .env file`);
        continue;
      }

      console.log(`Creating ${bucket.name.toLowerCase()} bucket`);
      const bucketName = bucket.id.toLowerCase().replace(/_/g, "-");

      try {
        await this.executeMinIOCommand([
          "mb",
          `myminio/${bucketName}`,
          "--ignore-existing",
        ]);
        console.log(`Successfully created/verified bucket ${bucketName}`);

        await this.setupBucketNotifications(bucketName, notifications);
      } catch (error: any) {
        console.log(`Error creating bucket ${bucketName}: ${error.message}`);
      }
    }
  };

  setupBucketNotifications = async (
    bucketName: string,
    notifications: MinioEvent[],
  ): Promise<void> => {
    console.log("Setting up event notifications");

    for (const notification of notifications) {
      try {
        await this.executeMinIOCommand([
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
          `Error setting up notification for ${notification.prefix}: ${error.message}`,
        );
      }
    }
  };

  // Utility methods
  executeMinIOCommand = async (args: string[]): Promise<string> => {
    if (this.#useLocalMc) {
      // Execute locally
      return this.executeCommand("mc", args);
    } else {
      // Execute in container using dockerode
      if (!this.#minioContainer) {
        throw new Error("MinIO container not initialized");
      }
      return this.executeDockerCommand(["mc", ...args]);
    }
  };

  executeDockerCommand = async (args: string[]): Promise<string> => {
    if (!this.#minioContainer) {
      throw new Error("MinIO container not initialized");
    }

    const exec = await this.#minioContainer.exec({
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

  public executeCommand = async (
    command: string,
    args: string[],
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
}
