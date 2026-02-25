import { execSync } from "child_process";

const numMaxTries: number = 3;
const args = process.argv.slice(2).join(" ");

const compose = async (tries: number = 0) => {
  try {
    // Try V2 first
    execSync(`docker compose ${args}`, { stdio: "inherit" });
  } catch (error) {
    try {
      // Fallback to V1
      execSync(`docker-compose ${args}`, { stdio: "inherit" });
    } catch (fallbackError: any) {
      if (tries < numMaxTries) {
        //Wait 2 seconds and try again
        await new Promise((res) => setTimeout(res, 2000));
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

try {
  compose(0);
} catch (error) {
  process.exit(1);
}
