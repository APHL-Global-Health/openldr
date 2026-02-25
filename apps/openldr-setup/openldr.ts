import fs from "fs";
import path from "path";
import * as prompts from "@inquirer/prompts";
import { services, docker } from "@repo/openldr-core";

async function updateEnvFile(
  filePath: string,
  key: string,
  value: string,
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
  try {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const DEFAULT_HTTP_PORT = 8090;
    const DEFAULT_HTTPS_PORT = 443;

    const { httpPort } = await prompts
      .input({
        message: "Default HTTP port for openldr-gateway",
        default: DEFAULT_HTTP_PORT.toString(),
        validate: (input: string) => {
          const value = parseInt(input, 10);
          return isNaN(value) || value < 1
            ? "Please enter a number greater than 0"
            : true;
        },
      })
      .then((answer) => ({ httpPort: parseInt(answer, 10) }));

      const { httpsPort } = await prompts
      .input({
        message: "Default HTTPS port for openldr-gateway",
        default: DEFAULT_HTTPS_PORT.toString(),
        validate: (input: string) => {
          const value = parseInt(input, 10);
          return isNaN(value) || value < 1
            ? "Please enter a number greater than 0"
            : true;
        },
      })
      .then((answer) => ({ httpsPort: parseInt(answer, 10) }));



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

    const env_path = path.resolve(__dirname, "..", "..", "environments");

    //Update base environments
    const env_base = path.join(env_path, ".env.base");
    await updateEnvFile(env_base, "HOST_IP", hostIp);
    await updateEnvFile(env_base, "GATEWAY_HTTP_PORT", httpPort.toString());
    await updateEnvFile(env_base, "GATEWAY_HTTPS_PORT", httpsPort.toString());

    //Update ai environments
    const env_ai = path.join(env_path, ".env.openldr-ai");
    await updateEnvFile(
      env_ai,
      "AI_CORS_ORIGINS",
      `https://${hostIp}:${httpsPort},https://${hostIp}:3000,http://${hostIp},http://${hostIp}:3000,https://${hostIp}:${httpsPort}/studio,https://${hostIp}:${httpsPort}/studio`,
    );

    //
    //Update entity services environments
    const env_entity_services = path.join(
      env_path,
      ".env.openldr-entity-services",
    );
    await updateEnvFile(
      env_entity_services,
      "ENTITY_SERVICES_PUBLIC_URL",
      `https://${hostIp}:${httpsPort}/entity-services`,
    );

    //Update data processing environments
    const env_data_processing = path.join(
      env_path,
      ".env.openldr-data-processing",
    );
    await updateEnvFile(
      env_data_processing,
      "DATA_PROCESSING_PUBLIC_URL",
      `https://${hostIp}:${httpsPort}/data-processing`,
    );

    //Update minio environments
    const env_minio = path.join(env_path, ".env.openldr-minio");
    await updateEnvFile(
      env_minio,
      "MINIO_BROWSER_REDIRECT_URL",
      `https://${hostIp}:${httpsPort}/minio-console/`,
    );
    await updateEnvFile(
      env_minio,
      "MINIO_PUBLIC_URL",
      `https://${hostIp}:${httpsPort}/minio-console/`,
    );

    //Update openconceptlab environments
    const env_ocl = path.join(env_path, ".env.openldr-openconceptlab");
    await updateEnvFile(env_ocl, "OCL_PUBLIC_URL", `https://${hostIp}:${httpsPort}/ocl-api`);

    //Update keycloak environments
    const env_keycloak = path.join(env_path, ".env.openldr-keycloak");
    await updateEnvFile(
      env_keycloak,
      "KEYCLOAK_PUBLIC_URL",
      `https://${hostIp}:${httpsPort}/keycloak`,
    );

    //Update studio environments
    const env_studio_vite = path.join(env_path, ".env.openldr-studio-vite");
    await updateEnvFile(
      env_studio_vite,
      "VITE_API_BASE_URL",
      `https://${hostIp}:${httpsPort}/entity-services`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_PROCESSOR_BASE_URL",
      `https://${hostIp}:${httpsPort}/data-processing`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_AI_BASE_URL",
      `https://${hostIp}:${httpsPort}/ai`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_KEYCLOAK_URL",
      `https://${hostIp}:${httpsPort}/keycloak`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_KEYCLOAK_DASHBOARD_URL",
      `https://${hostIp}:${httpsPort}/keycloak`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_MINIO_DASHBOARD_URL",
      `https://${hostIp}:${httpsPort}/minio-console`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_OPENSEARCH_DASHBOARD_URL",
      `https://${hostIp}:${httpsPort}/opensearch-dashboard`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_KAFKA_DASHBOARD_URL",
      `https://${hostIp}:${httpsPort}/kafka-console`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_NGINX_DASHBOARD_URL",
      `http://${hostIp}:${httpPort}`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_KEYCLOAK_DASHBOARD_URL",
      `https://${hostIp}:${httpsPort}/keycloak`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_MINIO_DASHBOARD_URL",
      `https://${hostIp}:${httpsPort}/minio-console`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_OPENSEARCH_DASHBOARD_URL",
      `https://${hostIp}:${httpsPort}/opensearch-dashboard`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_REDIS_DASHBOARD_URL",
      `https://${hostIp}:${httpsPort}/redis-dashboard`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_KAFKA_DASHBOARD_URL",
      `https://${hostIp}:${httpsPort}/kafka-console`,
    );
    await updateEnvFile(
      env_studio_vite,
      "VITE_OCL_URL",
      `https://${hostIp}:${httpsPort}/ocl-api`,
    );

    //Update studio environments
    const env_web_vite = path.join(env_path, ".env.openldr-web-vite");
    await updateEnvFile(env_web_vite, "VITE_APP_URL", `https://${hostIp}:${httpsPort}/web`);
  } catch (error) {
    throw new Error(
      `Failed to create openldr configuration: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
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
