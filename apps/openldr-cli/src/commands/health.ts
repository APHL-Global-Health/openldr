import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitRow, emitArray } from "../output.js";

const SERVICES: Array<{ name: string; path: string }> = [
  { name: "data-processing", path: "/data-processing/health" },
  { name: "entity-services", path: "/entity-services/health" },
  { name: "external-database", path: "/external-db/health" },
];

async function probe(url: string): Promise<{ ok: boolean; status?: number; body?: unknown; error?: string }> {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const ct = res.headers.get("content-type") ?? "";
    const body = ct.includes("application/json") ? await res.json().catch(() => undefined) : await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(tm);
  }
}

export function registerHealthCommand(program: Command): void {
  program
    .command("health")
    .description("Probe each HTTP service's /health endpoint via the gateway")
    .option("--service <name>", "narrow to a single service")
    .action(async (opts: { service?: string }) => {
      const cmd = program.commands.find((c) => c.name() === "health")!;
      const rt = loadRuntime(cmd);
      const targets = opts.service ? SERVICES.filter((s) => s.name === opts.service) : SERVICES;
      if (targets.length === 0) {
        process.stderr.write(JSON.stringify({ error: { code: "UNKNOWN_TARGET", message: `unknown service: ${opts.service}` } }) + "\n");
        process.exitCode = 2;
        return;
      }
      const results = await Promise.all(
        targets.map(async (s) => {
          const start = Date.now();
          const url = `${rt.config.gateway.url}${s.path}`;
          const r = await probe(url);
          return { service: s.name, url, elapsed_ms: Date.now() - start, ...r };
        }),
      );
      if (rt.output.format === "json" || rt.output.format === "table") {
        emitArray(results as unknown as Record<string, unknown>[], rt.output);
      } else {
        for (const r of results) emitRow(r as unknown as Record<string, unknown>, rt.output);
      }
      if (results.some((r) => !r.ok)) process.exitCode = 1;
    });
}
