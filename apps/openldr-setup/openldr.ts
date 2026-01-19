import fs from "fs";
import path from "path";
import * as prompts from "@inquirer/prompts";
import { services, docker } from "@repo/openldr-core";

async function resolveEnvPath(envFile: string) {
  const root = path.resolve(__dirname, "..", "..");
  const env = path.resolve(root, ".env" + envFile.replace(".env.template", ""));
  const template = path.resolve(root, "templates", envFile);

  try {
    await fs.promises.access(env);
    return env;
  } catch {
    try {
      await fs.promises.access(template);
      await fs.promises.copyFile(template, env);
      await fs.promises.chmod(env, 0o666);
      return env;
    } catch (error: any) {
      throw new Error(".env.template file not found");
    }
  }
}

async function updateEnvFile(
  filePath: string,
  key: string,
  value: string
): Promise<void> {
  let content = "";
  try {
    content = await fs.promises.readFile(filePath, "utf8");
  } catch (error) {
    // File doesn't exist, create it
    content = "";
  }

  const lines = content.split("\n");
  const keyPattern = new RegExp(`^${key}=`);
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (keyPattern.test(lines[i] || "")) {
      lines[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }

  if (!found) {
    lines.push(`${key}=${value}`);
  }

  await fs.promises.writeFile(filePath, lines.join("\n"));
}

async function updateEnvironmentFiles(
  hostIp: string,
  hostEnvironment: string,
  infraConfig: any,
  labDataEnv: string,
  infrastructureEnv: string,
  microservicesEnv: string,
  webEnv: string,
  logFilesToKeep: string
): Promise<void> {
  await updateEnvFile(infrastructureEnv, "HOST_IP", hostIp);
  // await updateEnvFile(infrastructureEnv, "DOCKER_HOST_IP", hostIp);
  // await updateEnvFile(infrastructureEnv, "HOST_ENVIRONMENT", hostEnvironment);
  await updateEnvFile(
    infrastructureEnv,
    "KEYCLOAK_PUBLIC_URL",
    `https://${hostIp}/keycloak`
  );
  // await updateEnvFile(
  //   infrastructureEnv,
  //   "KEYCLOAK_BASE_URL",
  //   `https://${hostIp}/keycloak`
  // );
  // await updateEnvFile(
  //   infrastructureEnv,
  //   "MINIO_BROWSER_REDIRECT_URL",
  //   `https://${hostIp}/minio-console/`
  // );
  await updateEnvFile(
    infrastructureEnv,
    "LOG_FILE_KEPT_NUMBER",
    logFilesToKeep
  );

  await updateEnvFile(microservicesEnv, "HOST_IP", hostIp);
  // await updateEnvFile(microservicesEnv, "DOCKER_HOST_IP", hostIp);
  // await updateEnvFile(microservicesEnv, "HOST_ENVIRONMENT", hostEnvironment);
  // await updateEnvFile(microservicesEnv, "KEYCLOAK_HOSTNAME", hostIp);
  await updateEnvFile(
    microservicesEnv,
    "KEYCLOAK_PUBLIC_URL",
    `https://${hostIp}/keycloak`
  );
  await updateEnvFile(microservicesEnv, "LOG_FILE_KEPT_NUMBER", logFilesToKeep);

  // Update web .env
  await updateEnvFile(
    webEnv,
    "VITE_API_BASE_URL",
    `https://${hostIp}/apisix-gateway`
  );
  await updateEnvFile(
    webEnv,
    "VITE_KEYCLOAK_URL",
    `https://${hostIp}/keycloak`
  );
  await updateEnvFile(
    webEnv,
    "VITE_APISIX_DASHBOARD_URL",
    `https://${hostIp}/apisix-dashboard`
  );
  await updateEnvFile(
    webEnv,
    "VITE_KEYCLOAK_DASHBOARD_URL",
    `https://${hostIp}/keycloak`
  );
  await updateEnvFile(
    webEnv,
    "VITE_MINIO_DASHBOARD_URL",
    `https://${hostIp}/minio-console`
  );
  await updateEnvFile(
    webEnv,
    "VITE_OPENSEARCH_DASHBOARD_URL",
    `https://${hostIp}/opensearch-dashboard`
  );
  await updateEnvFile(
    webEnv,
    "VITE_REDIS_DASHBOARD_URL",
    `https://${hostIp}/redis-dashboard`
  );
  await updateEnvFile(
    webEnv,
    "VITE_KAFKA_DASHBOARD_URL",
    `https://${hostIp}/kafka-console`
  );

  await updateEnvFile(
    webEnv,
    "VITE_KEYCLOAK_CLIENT_SECRET",
    infraConfig.KEYCLOAK_CLIENT_SECRET || ""
  );
  await updateEnvFile(webEnv, "LOG_FILE_KEPT_NUMBER", logFilesToKeep);

  // Update Admin Dashboard URLs
  await updateEnvFile(
    webEnv,
    "VITE_APISIX_DASHBOARD_URL",
    `https://${hostIp}/apisix-dashboard`
  );
  await updateEnvFile(
    webEnv,
    "VITE_KEYCLOAK_DASHBOARD_URL",
    `https://${hostIp}/keycloak`
  );
  await updateEnvFile(
    webEnv,
    "VITE_MINIO_DASHBOARD_URL",
    `https://${hostIp}/minio-console`
  );
  await updateEnvFile(
    webEnv,
    "VITE_OPENSEARCH_DASHBOARD_URL",
    `https://${hostIp}/opensearch-dashboard`
  );
  await updateEnvFile(
    webEnv,
    "VITE_REDIS_DASHBOARD_URL",
    `https://${hostIp}/redis-dashboard`
  );
  await updateEnvFile(
    webEnv,
    "VITE_KAFKA_DASHBOARD_URL",
    `https://${hostIp}/kafka-console`
  );
  await updateEnvFile(webEnv, "VITE_OCL_URL", `https://${hostIp}/oclapi/`);
}

async function createNetworkIfNotExists() {
  const networkName = "openldr-network";

  try {
    // Check if network already exists
    const networks = await docker.listNetworks({
      filters: { name: [networkName] },
    });

    if (networks.length > 0) {
      console.log(`Network '${networkName}' already exists, continuing...`);
      return;
    }

    // Create the network
    await docker.createNetwork({
      Name: networkName,
      Driver: "bridge",
    });

    console.log(`Network '${networkName}' created successfully`);
  } catch (error: any) {
    console.error("Error managing Docker network:", error.message);
    process.exit(1);
  }
}

async function init() {
  const DEFAULT_LOG_COUNT = 5;

  const labDataEnv = await resolveEnvPath(".env.template.labdata");
  const infrastructureEnv = await resolveEnvPath(
    ".env.template.infrastructure"
  );
  const microservicesEnv = await resolveEnvPath(".env.template.microservices");
  const webEnv = await resolveEnvPath(".env.template.web");

  const oclEnv = await resolveEnvPath(".env.template.ocl");

  try {
    // Load environment configurations
    const infraConfig = await services.getEnvContent(infrastructureEnv);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const { logFilesToKeep } = await prompts
      .input({
        message: "How many log files would you like to keep?",
        default: DEFAULT_LOG_COUNT.toString(),
        validate: (input: string) => {
          const value = parseInt(input, 10);
          return isNaN(value) || value < 1
            ? "Please enter a number greater than 0"
            : true;
        },
      })
      .then((answer) => ({ logFilesToKeep: parseInt(answer, 10) }));

    // Get system information
    const systemInfo = await services.getSystemInfo();

    // Display IP options and get user selection
    let hostIp: string = "";
    if (systemInfo.ipAddresses.length > 0) {
      if (systemInfo.ipAddresses.length > 1) {
        // await this.logMessage("TASK", "Available IP addresses:");

        const { select } = prompts;
        const ipChoices = systemInfo.ipAddresses.map((ip, index) => ({
          title: `${ip} - ${systemInfo.ipDescriptions[index]}`,
          value: ip,
        }));

        const selectedIndex = await select({
          message: "Select the IP address for the host",
          choices: ipChoices.map((choice, idx) => ({
            name: choice.value,
            value: idx,
          })),
        });
        hostIp = systemInfo.ipAddresses[selectedIndex] || "";
      } else {
        hostIp = systemInfo.ipAddresses[0] || "";
      }
    }

    // Update .env files with selected configuration
    await updateEnvironmentFiles(
      hostIp,
      systemInfo.hostEnvironment,
      infraConfig,
      labDataEnv,
      infrastructureEnv,
      microservicesEnv,
      webEnv,
      logFilesToKeep.toString()
    );

    // // Configure resource limits
    // await this.configureResourceLimits(infraEnv);
  } catch (error) {
    throw new Error(
      `Failed to create openldr configuration: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

const { command, dir } = services.processArguments(__dirname, process.argv);
switch (command) {
  case "init":
    init();
    break;
  case "build":
    createNetworkIfNotExists();
    break;
  case "setup":
    console.log(`Running setup - ${dir}`);
    break;
  case "reset":
    console.log(`Running reset - ${dir}`);
    break;
  case "stop":
    console.log(`Stopping services - ${dir}`);
    break;
  case "start":
    console.log(`Starting services - ${dir}`);
    break;
  default:
    throw new Error(`Unknown command: ${command} - ${dir}`);
}
