import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray } from "../output.js";

export function registerServicesCommand(program: Command): void {
  program
    .command("services")
    .description("List all known services with their resolved endpoint")
    .action(() => {
      const cmd = program.commands.find((c) => c.name() === "services")!;
      const rt = loadRuntime(cmd);
      const cfg = rt.config;
      const rows = [
        { name: "postgres", role: "primary RDBMS (openldr + openldr_external)", endpoint: `${cfg.postgres.host}:${cfg.postgres.port}` },
        { name: "kafka", role: "message queue (queue commands)", endpoint: cfg.kafka.brokers.join(",") },
        { name: "minio", role: "S3-compatible object storage (s3 commands)", endpoint: cfg.s3.endpoint },
        { name: "opensearch", role: "search backend (search commands)", endpoint: cfg.search.url },
        { name: "keycloak", role: "OAuth2/OIDC identity (auth commands)", endpoint: cfg.auth.baseUrl },
        { name: "gateway", role: "HTTPS reverse proxy (HTTP service entrypoint)", endpoint: cfg.gateway.url },
        { name: "data-processing", role: "ingest + run tracking API", endpoint: cfg.services.dataProcessingUrl },
        { name: "entity-services", role: "users, plugins, forms, terminology", endpoint: cfg.services.entityServicesUrl },
      ];
      emitArray(rows as unknown as Record<string, unknown>[], rt.output);
    });
}
