import type { Command } from "commander";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import readline from "node:readline";
import { loadRuntime } from "../runtime.js";
import { emitText, emitRow } from "../output.js";
import { CliError } from "../errors.js";
import { requestGateway } from "../clients/gateway.js";
import { getClientCredentialsToken } from "../clients/auth.js";

interface IngestResult {
  file: string;
  messageId?: string;
  status: "submitted" | "validated" | "failed";
  error?: string;
}

async function validatePayload(file: string): Promise<unknown> {
  const buf = await readFile(file, "utf8");
  try {
    return JSON.parse(buf);
  } catch (err) {
    throw new CliError("CONFIG_INVALID", `Payload is not valid JSON: ${err instanceof Error ? err.message : String(err)}`, { file });
  }
}

export function registerIngestCommand(program: Command): void {
  const ingest = program.command("ingest").description("Submit payloads to the data-processing pipeline");

  ingest
    .command("submit <file>")
    .description("POST a payload to /api/v1/processor/process-feed and optionally track to terminal status")
    .requiredOption("--feed <id>", "dataFeedId to attribute the payload to")
    .option("--dry-run", "validate locally without contacting the gateway", false)
    .option("--dry-run-post", "print the prepared HTTP request without sending", false)
    .option("--track", "poll the resulting run to terminal status", false)
    .option("--track-timeout <s>", "timeout for --track in seconds", "120")
    .option("--track-interval <s>", "poll interval for --track in seconds", "2")
    .action(
      async (
        file: string,
        opts: {
          feed: string;
          dryRun?: boolean;
          dryRunPost?: boolean;
          track?: boolean;
          trackTimeout: string;
          trackInterval: string;
        },
      ) => {
        const cmd = ingest.commands.find((c) => c.name() === "submit")!;
        const rt = loadRuntime(cmd);
        const payload = await validatePayload(file);
        if (opts.dryRun) {
          emitText(JSON.stringify({ file, feed: opts.feed, valid: true }));
          return;
        }
        const token = await getClientCredentialsToken(rt.config);
        const url = `${rt.config.gateway.url}/data-processing/api/v1/processor/process-feed`;
        if (opts.dryRunPost) {
          emitText(
            JSON.stringify(
              {
                method: "POST",
                url,
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer ***",
                  "X-DataFeed-Id": opts.feed,
                },
                body: payload,
              },
              null,
              2,
            ),
          );
          return;
        }
        const res = await requestGateway<{ messageId?: string }>(rt.config, {
          method: "POST",
          path: "/data-processing/api/v1/processor/process-feed",
          headers: { "X-DataFeed-Id": opts.feed, Authorization: `Bearer ${token}` },
          auth: "none",
          body: payload,
          expectStatus: [200, 201, 202],
        });
        const messageId = res.data?.messageId;
        emitRow({ file, feed: opts.feed, status: res.status, messageId } as Record<string, unknown>, rt.output);
        if (opts.track && messageId) {
          // Poll the data-processing runs API (no direct Postgres dependency).
          const intervalMs = (parseInt(opts.trackInterval, 10) || 2) * 1_000;
          const deadline = Date.now() + (parseInt(opts.trackTimeout, 10) || 120) * 1_000;
          const terminal = new Set(["SUCCESS", "FAILED", "COMPLETED", "ERROR"]);
          interface RunDetail { run?: { currentStage?: string; currentStatus?: string }; currentStage?: string; currentStatus?: string }
          while (Date.now() < deadline) {
            const r = await requestGateway<RunDetail>(rt.config, {
              path: `/data-processing/api/v1/runs/${encodeURIComponent(messageId)}`,
              expectStatus: [200, 404],
            });
            const row = r.status === 200 ? (r.data.run ?? (r.data as RunDetail)) : undefined;
            if (row && row.currentStage && row.currentStatus) {
              emitRow(row as unknown as Record<string, unknown>, rt.output);
              if (terminal.has(row.currentStatus.toUpperCase())) return;
            }
            await new Promise((r) => setTimeout(r, intervalMs));
          }
          throw new CliError("TIMEOUT", `Run did not reach terminal status within ${opts.trackTimeout}s`, { messageId });
        }
      },
    );

  ingest
    .command("validate <file>")
    .description("Local payload validation only (no network)")
    .action(async (file: string) => {
      const cmd = ingest.commands.find((c) => c.name() === "validate")!;
      const rt = loadRuntime(cmd);
      const payload = await validatePayload(file);
      emitRow(
        {
          file,
          valid: true,
          size_bytes: (await readFile(file)).length,
          top_level_keys: typeof payload === "object" && payload !== null ? Object.keys(payload as object).slice(0, 20) : [],
        } as Record<string, unknown>,
        rt.output,
      );
    });

  ingest
    .command("batch <dir>")
    .description("Submit every payload in a directory (NDJSON journal to stdout, summary to stderr)")
    .requiredOption("--feed <id>", "dataFeedId")
    .option("--concurrency <n>", "parallel POST workers", "2")
    .option("--resume-from <i>", "skip the first N files", "0")
    .option("--confirm", "actually submit (without this, runs in --dry-run-post mode)", false)
    .action(
      async (
        dir: string,
        opts: { feed: string; concurrency: string; resumeFrom: string; confirm?: boolean },
      ) => {
        const cmd = ingest.commands.find((c) => c.name() === "batch")!;
        const rt = loadRuntime(cmd);
        const entries = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
        const skip = parseInt(opts.resumeFrom, 10) || 0;
        const files = entries.slice(skip);
        const concurrency = Math.max(1, parseInt(opts.concurrency, 10) || 2);
        const url = "/data-processing/api/v1/processor/process-feed";
        const results: IngestResult[] = [];
        let idx = 0;
        async function worker(): Promise<void> {
          while (true) {
            const myIdx = idx++;
            if (myIdx >= files.length) return;
            const file = resolve(dir, files[myIdx]!);
            try {
              const payload = await validatePayload(file);
              if (!opts.confirm) {
                emitRow({ file, status: "validated", feed: opts.feed } as Record<string, unknown>, rt.output);
                results.push({ file, status: "validated" });
                continue;
              }
              const token = await getClientCredentialsToken(rt.config);
              const res = await requestGateway<{ messageId?: string }>(rt.config, {
                method: "POST",
                path: url,
                headers: { "X-DataFeed-Id": opts.feed, Authorization: `Bearer ${token}` },
                auth: "none",
                body: payload,
                expectStatus: [200, 201, 202],
              });
              const messageId = res.data?.messageId;
              emitRow({ file, status: "submitted", messageId } as Record<string, unknown>, rt.output);
              results.push({ file, messageId, status: "submitted" });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              emitRow({ file, status: "failed", error: msg } as Record<string, unknown>, rt.output);
              results.push({ file, status: "failed", error: msg });
            }
          }
        }
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        process.stderr.write(
          JSON.stringify({
            total: files.length,
            submitted: results.filter((r) => r.status === "submitted").length,
            validated: results.filter((r) => r.status === "validated").length,
            failed: results.filter((r) => r.status === "failed").length,
          }) + "\n",
        );
      },
    );

  ingest
    .command("stream")
    .description(
      "Read NDJSON payloads from stdin and POST each to /data-processing/api/v1/processor/process-feed. " +
        "Designed to be the consumer side of `cdr-toolchain export-batch --emit-payloads | openldr ingest stream`.",
    )
    .requiredOption("--feed <id>", "dataFeedId to attribute every payload to")
    .option("--concurrency <n>", "parallel POST workers", "4")
    .option("--track", "after each POST, poll the run to terminal status", false)
    .option("--track-timeout <s>", "per-run track timeout (seconds)", "60")
    .option("--track-interval <s>", "per-run poll interval (seconds)", "2")
    .option("--dry-run-post", "print the prepared HTTP request for each line, no network", false)
    .option("--fail-fast", "abort on the first failed POST", false)
    .action(
      async (opts: {
        feed: string;
        concurrency: string;
        track?: boolean;
        trackTimeout: string;
        trackInterval: string;
        dryRunPost?: boolean;
        failFast?: boolean;
      }) => {
        const cmd = ingest.commands.find((c) => c.name() === "stream")!;
        const rt = loadRuntime(cmd);
        const concurrency = Math.max(1, parseInt(opts.concurrency, 10) || 4);
        const path = "/data-processing/api/v1/processor/process-feed";
        const trackIntervalMs = (parseInt(opts.trackInterval, 10) || 2) * 1_000;
        const trackTimeoutMs = (parseInt(opts.trackTimeout, 10) || 60) * 1_000;
        const terminal = new Set(["SUCCESS", "FAILED", "COMPLETED", "ERROR"]);

        // One token, reused across workers — getClientCredentialsToken caches
        // until ~5s before expiry, so this stays valid for the whole stream.
        let cachedToken: string | undefined;
        const token = async (): Promise<string> => {
          cachedToken = await getClientCredentialsToken(rt.config);
          return cachedToken;
        };

        const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
        const iter = rl[Symbol.asyncIterator]();
        const started = Date.now();
        let seq = 0;
        let submitted = 0;
        let failed = 0;
        let parsed = 0;
        let aborted = false;

        interface RunDetail {
          run?: { currentStage?: string; currentStatus?: string };
          currentStage?: string;
          currentStatus?: string;
        }

        async function trackRun(messageId: string): Promise<void> {
          const deadline = Date.now() + trackTimeoutMs;
          while (Date.now() < deadline) {
            const r = await requestGateway<RunDetail>(rt.config, {
              path: `/data-processing/api/v1/runs/${encodeURIComponent(messageId)}`,
              expectStatus: [200, 404],
            });
            const row = r.status === 200 ? (r.data.run ?? (r.data as RunDetail)) : undefined;
            if (row?.currentStatus && terminal.has(row.currentStatus.toUpperCase())) {
              emitRow(
                {
                  seq: undefined,
                  messageId,
                  trackStatus: row.currentStatus,
                  trackStage: row.currentStage,
                } as Record<string, unknown>,
                rt.output,
              );
              return;
            }
            await new Promise((r2) => setTimeout(r2, trackIntervalMs));
          }
          emitRow(
            { messageId, trackStatus: "TIMEOUT" } as Record<string, unknown>,
            rt.output,
          );
        }

        async function worker(): Promise<void> {
          while (!aborted) {
            const { value, done } = await iter.next();
            if (done) return;
            const line = value.trim();
            if (line.length === 0) continue;
            const mySeq = ++seq;
            let payload: unknown;
            try {
              payload = JSON.parse(line);
              parsed++;
            } catch (err) {
              failed++;
              emitRow(
                {
                  seq: mySeq,
                  status: "parse_error",
                  error: err instanceof Error ? err.message : String(err),
                } as Record<string, unknown>,
                rt.output,
              );
              if (opts.failFast) aborted = true;
              continue;
            }

            if (opts.dryRunPost) {
              emitRow(
                {
                  seq: mySeq,
                  method: "POST",
                  url: `${rt.config.gateway.url}${path}`,
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer ***",
                    "X-DataFeed-Id": opts.feed,
                  },
                  bodySize: line.length,
                } as Record<string, unknown>,
                rt.output,
              );
              continue;
            }

            try {
              const tok = cachedToken ?? (await token());
              const res = await requestGateway<{ messageId?: string }>(rt.config, {
                method: "POST",
                path,
                headers: { "X-DataFeed-Id": opts.feed, Authorization: `Bearer ${tok}` },
                auth: "none",
                body: payload,
                expectStatus: [200, 201, 202],
              });
              const messageId = res.data?.messageId;
              submitted++;
              emitRow(
                { seq: mySeq, status: "submitted", messageId } as Record<string, unknown>,
                rt.output,
              );
              if (opts.track && messageId) {
                await trackRun(messageId);
              }
            } catch (err) {
              failed++;
              const cause = err instanceof Error ? err.message : String(err);
              emitRow(
                { seq: mySeq, status: "failed", error: cause } as Record<string, unknown>,
                rt.output,
              );
              if (opts.failFast) {
                aborted = true;
                rl.close();
              }
            }
          }
        }

        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        rl.close();

        process.stderr.write(
          JSON.stringify({
            total: seq,
            parsed,
            submitted,
            failed,
            elapsed_ms: Date.now() - started,
            aborted,
          }) + "\n",
        );
        if (failed > 0) process.exitCode = 1;
      },
    );
}
