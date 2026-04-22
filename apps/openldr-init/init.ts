import "dotenv/config";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths to each init script relative to the monorepo workspace layout
// Inside the Docker image, the full workspace is at /app
const APPS_ROOT = path.resolve(__dirname, "..");

const run = (label: string, script: string, args: string) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  [openldr-init] ${label}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    execSync(`tsx ${script} ${args}`, {
      cwd: path.dirname(script),
      stdio: "inherit",
      env: { ...process.env },
    });
    console.log(`\n  [openldr-init] ${label} — done\n`);
  } catch (err: any) {
    console.error(`\n  [openldr-init] ${label} — FAILED (exit ${err.status})\n`);
    throw err;
  }
};

const main = async () => {
  console.log("[openldr-init] Starting post-startup initialization...\n");

  // 1. Keycloak: realm import + OAuth client creation
  run(
    "Keycloak initialization",
    path.join(APPS_ROOT, "openldr-keycloak", "openldr.ts"),
    "start",
  );

  // 2. Kafka: OpenSearch sink connector creation
  run(
    "Kafka initialization",
    path.join(APPS_ROOT, "openldr-kafka", "openldr.ts"),
    "start",
  );

  // 3. MinIO: plugin seeding, bucket creation, Kafka notifications
  run(
    "MinIO initialization",
    path.join(APPS_ROOT, "openldr-minio", "openldr.ts"),
    "start",
  );

  console.log("\n[openldr-init] All initialization complete. Exiting.\n");
};

main().catch((err) => {
  console.error("[openldr-init] Initialization failed:", err.message);
  process.exit(1);
});
