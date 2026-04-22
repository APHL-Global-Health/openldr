import { execSync } from "child_process";

const args = process.argv.slice(2).join(" ");

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const compose = async (tries: number = 0) => {
  try {
    // Try V2 first
    execSync(`docker compose ${args}`, { stdio: "inherit" });
  } catch (error) {
    try {
      // Fallback to V1
      execSync(`docker-compose ${args}`, { stdio: "inherit" });
    } catch (fallbackError: any) {
      if (
        tries < 3
        // && (fallbackError.message.includes("failed to resolve") ||
        //   fallbackError.message.includes("failed to do request"))
      ) {
        //Wait 2 seconds and try again
        await sleep(2000);
        compose(tries++);
      } else {
        console.error(
          "Neither docker compose nor docker-compose worked: " +
            fallbackError.message
        );
        process.exit(1);
      }
    }
  }
};
compose(0);
