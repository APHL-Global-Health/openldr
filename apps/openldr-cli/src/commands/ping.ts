import type { Command } from "commander";
import net from "node:net";
import { loadRuntime } from "../runtime.js";
import { emitRow, emitArray } from "../output.js";
import type { LoadedConfig } from "../config.js";

interface PingResult {
  service: string;
  endpoint: string;
  ok: boolean;
  elapsed_ms: number;
  error?: string;
}

async function tcpCheck(host: string, port: number, timeoutMs = 4_000): Promise<{ ok: boolean; error?: string }> {
  return await new Promise((resolveP) => {
    const sock = new net.Socket();
    const tm = setTimeout(() => {
      sock.destroy();
      resolveP({ ok: false, error: "timeout" });
    }, timeoutMs);
    sock.once("connect", () => {
      clearTimeout(tm);
      sock.destroy();
      resolveP({ ok: true });
    });
    sock.once("error", (err) => {
      clearTimeout(tm);
      sock.destroy();
      resolveP({ ok: false, error: err.message });
    });
    sock.connect(port, host);
  });
}

async function httpCheck(url: string, timeoutMs = 4_000): Promise<{ ok: boolean; error?: string; status?: number }> {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(tm);
  }
}

async function pingService(name: string, endpoint: string, check: () => Promise<{ ok: boolean; error?: string }>): Promise<PingResult> {
  const start = Date.now();
  const { ok, error } = await check();
  return { service: name, endpoint, ok, elapsed_ms: Date.now() - start, ...(error ? { error } : {}) };
}

function gatewayHost(cfg: LoadedConfig): { host: string; port: number } {
  const u = new URL(cfg.gateway.url);
  return { host: u.hostname, port: u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80 };
}

export function registerPingCommand(program: Command): void {
  program
    .command("ping")
    .description("Connectivity smoke-test for every backing service (TCP + HTTP)")
    .action(async () => {
      const cmd = program.commands.find((c) => c.name() === "ping")!;
      const rt = loadRuntime(cmd);
      const cfg = rt.config;
      const checks: Promise<PingResult>[] = [];

      // Postgres (TCP)
      checks.push(
        pingService("postgres", `${cfg.postgres.host}:${cfg.postgres.port}`, () =>
          tcpCheck(cfg.postgres.host, cfg.postgres.port),
        ),
      );
      // Kafka (TCP first broker)
      const firstBroker = cfg.kafka.brokers[0] ?? "127.0.0.1:9094";
      const [kHost, kPortStr] = firstBroker.split(":");
      const kPort = parseInt(kPortStr ?? "9094", 10);
      checks.push(
        pingService("kafka", firstBroker, () => tcpCheck(kHost ?? "127.0.0.1", kPort)),
      );
      // MinIO/S3 (HTTP)
      checks.push(
        pingService("s3", cfg.s3.endpoint, () => httpCheck(`${cfg.s3.endpoint}/minio/health/live`)),
      );
      // OpenSearch (HTTP)
      checks.push(pingService("search", cfg.search.url, () => httpCheck(cfg.search.url)));
      // Keycloak (HTTP)
      checks.push(
        pingService("auth", cfg.auth.baseUrl, () =>
          httpCheck(`${cfg.auth.baseUrl}/realms/${cfg.auth.realm}/.well-known/openid-configuration`),
        ),
      );
      // Gateway (TCP)
      const gw = gatewayHost(cfg);
      checks.push(
        pingService("gateway", cfg.gateway.url, () => tcpCheck(gw.host, gw.port)),
      );

      const results = await Promise.all(checks);
      if (rt.output.format === "json" || rt.output.format === "table") {
        emitArray(results as unknown as Record<string, unknown>[], rt.output);
      } else {
        for (const r of results) emitRow(r as unknown as Record<string, unknown>, rt.output);
      }

      const anyFailed = results.some((r) => !r.ok);
      if (anyFailed) process.exitCode = 1;
    });
}
