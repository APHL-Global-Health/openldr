import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitRow, emitArray } from "../output.js";

interface PingResult {
  service: string;
  endpoint: string;
  via: "gateway" | "direct";
  ok: boolean;
  status?: number;
  elapsed_ms: number;
  error?: string;
}

async function httpProbe(url: string, timeoutMs = 5_000): Promise<{ ok: boolean; status?: number; error?: string }> {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: ctrl.signal });
    return { ok: res.status < 500, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(tm);
  }
}

async function probeService(
  name: string,
  endpoint: string,
  via: "gateway" | "direct",
  check: () => Promise<{ ok: boolean; status?: number; error?: string }>,
): Promise<PingResult> {
  const start = Date.now();
  const r = await check();
  return {
    service: name,
    endpoint,
    via,
    ok: r.ok,
    elapsed_ms: Date.now() - start,
    ...(r.status !== undefined ? { status: r.status } : {}),
    ...(r.error ? { error: r.error } : {}),
  };
}

export function registerPingCommand(program: Command): void {
  program
    .command("ping")
    .description(
      "Connectivity smoke-test via the HTTPS gateway. Probes every gateway-routable service. " +
        "Postgres and Kafka native protocols are not reachable from outside docker and are skipped by default.",
    )
    .option(
      "--internal",
      "Also probe direct ports (Postgres TCP, Kafka TCP) — only works when run inside the docker network",
      false,
    )
    .action(async (opts: { internal?: boolean }) => {
      const cmd = program.commands.find((c) => c.name() === "ping")!;
      const rt = loadRuntime(cmd);
      const cfg = rt.config;
      const gw = cfg.gateway.url;

      const probes: Promise<PingResult>[] = [
        probeService("gateway", gw, "gateway", () => httpProbe(`${gw}/health`)),
        probeService("auth", `${gw}/keycloak`, "gateway", () =>
          httpProbe(`${gw}/keycloak/realms/${cfg.auth.realm}/.well-known/openid-configuration`),
        ),
        probeService("data-processing", `${gw}/data-processing`, "gateway", () =>
          httpProbe(`${gw}/data-processing/health`),
        ),
        probeService("entity-services", `${gw}/entity-services`, "gateway", () =>
          httpProbe(`${gw}/entity-services/health`),
        ),
        probeService("external-database", `${gw}/external-database`, "gateway", () =>
          httpProbe(`${gw}/external-database/health`),
        ),
        probeService("s3", `${gw}/minio`, "gateway", () => httpProbe(`${gw}/minio/minio/health/live`)),
        probeService("search", `${gw}/opensearch`, "gateway", () => httpProbe(`${gw}/opensearch`)),
        probeService("kafka-connect", `${gw}/kafka-connect`, "gateway", () =>
          httpProbe(`${gw}/kafka-connect`),
        ),
      ];

      if (opts.internal) {
        const net = await import("node:net");
        const tcp = (host: string, port: number, timeoutMs = 3_000) =>
          new Promise<{ ok: boolean; error?: string }>((resolveP) => {
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

        probes.push(
          probeService("postgres", `${cfg.postgres.host}:${cfg.postgres.port}`, "direct", () =>
            tcp(cfg.postgres.host, cfg.postgres.port),
          ),
        );
        const firstBroker = cfg.kafka.brokers[0] ?? "127.0.0.1:9094";
        const [kHost, kPortStr] = firstBroker.split(":");
        probes.push(
          probeService("kafka", firstBroker, "direct", () =>
            tcp(kHost ?? "127.0.0.1", parseInt(kPortStr ?? "9094", 10)),
          ),
        );
      }

      const results = await Promise.all(probes);
      if (rt.output.format === "json" || rt.output.format === "table") {
        emitArray(results as unknown as Record<string, unknown>[], rt.output);
      } else {
        for (const r of results) emitRow(r as unknown as Record<string, unknown>, rt.output);
      }
      if (results.some((r) => !r.ok)) process.exitCode = 1;
    });
}
