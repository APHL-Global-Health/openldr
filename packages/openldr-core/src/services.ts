import chalk from "chalk";
import fs from "fs";
import os from "os";
import path from "path";
import * as dotenv from "dotenv";
import { SystemInfo, EnvConfig } from "./types.js";
import { execSync } from "child_process";
import Dockerode from "dockerode";

export function processArguments(dir: string, argv: string[]) {
  const args = argv.slice(2);
  const command = args[0];
  const arguements = args.slice(1);

  if (command && dir) {
    console.log(
      chalk.cyan(`\n${command?.toUpperCase()}: ${path.basename(dir)}`)
    );
  } else throw new Error(`Unknown command: ${command} - ${dir}`);

  return {
    dir,
    repo: path.basename(dir),
    command,
    arguements,
  };
}

export async function isWSL(): Promise<boolean> {
  try {
    const version = await fs.promises.readFile("/proc/version", "utf8");
    return version.toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

export function getStandardNetworkInfo(
  networkInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>,
  ipAddresses: string[],
  ipDescriptions: string[]
): void {
  for (const interfaces of Object.values(networkInterfaces)) {
    if (interfaces) {
      for (const iface of interfaces) {
        if (iface.family === "IPv4" && !iface.internal) {
          ipAddresses.push(iface.address);
          ipDescriptions.push(
            "Local network IP (recommended for local development)"
          );
        }
      }
    }
  }
}

export async function getEnvContent(filePath: string): Promise<EnvConfig> {
  const content = await fs.promises.readFile(filePath, "utf8");
  const config: EnvConfig = {};

  content.split("\n").forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        config[key] = valueParts.join("=");
      }
    }
  });

  return config;
}

export function loadEnv(envPath: string) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    dotenv.config({ path: envPath, quiet: true });
  } else {
    throw new Error(`.env file not found at ${envPath}`);
  }
}

export async function updateEnvFile(
  filePath: string,
  key: string,
  value: string
): Promise<void> {
  try {
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
    const text = found
      ? `Updated ${key} in ${filePath}`
      : `Added ${key} to ${filePath}`;
    console.log(text);
  } catch (error) {
    console.log(`Failed to update ${filePath}: ${error}`);
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  let machineName = os.hostname();
  let macAddress = "";
  let ipAddresses: string[] = ["127.0.0.1"];
  let ipDescriptions: string[] = ["localhost"];

  const platform = os.platform();
  const networkInterfaces = os.networkInterfaces();

  // Get MAC address from first non-loopback interface
  for (const [interfaceName, interfaces] of Object.entries(networkInterfaces)) {
    if (interfaces && interfaceName !== "lo") {
      const iface = interfaces.find((i) => i.family === "IPv4" && !i.internal);
      if (iface && iface.mac && iface.mac !== "00:00:00:00:00:00") {
        macAddress = iface.mac;
        break;
      }
    }
  }

  if (platform === "darwin") {
    // macOS
    try {
      machineName = execSync("scutil --get ComputerName", {
        encoding: "utf8",
      }).trim();
    } catch (error) {
      // Keep hostname if scutil fails
    }

    // Get IP addresses
    for (const interfaces of Object.values(networkInterfaces)) {
      if (interfaces) {
        for (const iface of interfaces) {
          if (iface.family === "IPv4" && !iface.internal) {
            ipAddresses.push(iface.address);
            ipDescriptions.push(
              "Local network IP (recommended for local development)"
            );
          }
        }
      }
    }
  } else if (await isWSL()) {
    // WSL
    try {
      const wslIp = execSync(
        "ip addr show eth0 | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){3}'",
        { encoding: "utf8" }
      ).trim();
      const windowsHostIp = execSync(
        "ip route show | grep -i 'default via' | awk '{print $3}'",
        { encoding: "utf8" }
      ).trim();
      const externalIp = execSync("curl -s ifconfig.me", {
        encoding: "utf8",
      }).trim();

      ipAddresses = [wslIp, windowsHostIp, externalIp];
      ipDescriptions = [
        "WSL IP (for internal WSL access)",
        "Windows Host IP (for cross-WSL/Windows access)",
        "External IP (for public access)",
      ];
    } catch (error) {
      // Fallback to standard network interfaces
      getStandardNetworkInfo(networkInterfaces, ipAddresses, ipDescriptions);
    }
  } else {
    // Native Linux/Unix
    getStandardNetworkInfo(networkInterfaces, ipAddresses, ipDescriptions);
  }

  const hostEnvironment = `${machineName}-${macAddress.replace(/:/g, "")}`;

  return {
    isSetup: false,
    machineName,
    macAddress,
    ipAddresses,
    ipDescriptions,
    hostEnvironment,
  };
}

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
};

// Helper function to check container health before deploying routes
export const waitForContainerHealth = async (
  containerName: string,
  timeoutMs: number = 60000,
  docker: Dockerode
): Promise<void> => {
  console.log(`Waiting for container ${containerName} to be healthy...`);

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const container = docker.getContainer(containerName);
      const info = await container.inspect();

      if (info.State.Health?.Status === "healthy") {
        console.log(`Container ${containerName} is healthy!`);
        return;
      }

      console.log(
        `Container health status: ${info.State.Health?.Status || "unknown"}`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error checking container health:`, error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error(
    `Container ${containerName} did not become healthy within ${timeoutMs}ms`
  );
};
