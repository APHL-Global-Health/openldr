import fs from "fs";
import os from "os";
import Docker from "dockerode";
import { execSync } from "child_process";

const docker = createDockerConnection();

function getActiveDockerContext() {
  try {
    // Get the name of the active context
    const contextName = execSync("docker context show", {
      encoding: "utf8",
    }).trim();

    console.log(`Using Docker context: ${contextName}`);

    // Get current context info
    const contextInfo = execSync(`docker context inspect ${contextName}`, {
      encoding: "utf8",
    });
    const contexts = JSON.parse(contextInfo);

    if (contexts.length > 0) {
      const endpoint = contexts[0].Endpoints?.docker?.Host;
      if (endpoint?.startsWith("unix://")) {
        return endpoint.replace("unix://", "");
      }
    }
  } catch (error) {
    console.log("Could not detect Docker context, using default");
  }

  return "/var/run/docker.sock"; // fallback
}

function createDockerConnection() {
  const platform = os.platform();
  if (platform === "win32") {
    return new Docker();
  } else {
    const socketPath = getActiveDockerContext();
    console.log(`Using Docker socket: ${socketPath} \n`);

    // Verify socket exists
    if (!fs.existsSync(socketPath)) {
      throw new Error(`Docker socket not found: ${socketPath}`);
    }

    return new Docker({ socketPath });
  }
}

export { docker };
