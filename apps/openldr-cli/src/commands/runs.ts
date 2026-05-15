import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray, emitRow, emitText } from "../output.js";
import { CliError } from "../errors.js";
import { requestGateway } from "../clients/gateway.js";

interface RunRow {
  id?: string;
  messageId?: string;
  projectId?: string;
  dataFeedId?: string | null;
  currentStage?: string;
  currentStatus?: string;
  errorStage?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

interface ListRunsResponse {
  data?: RunRow[];
  items?: RunRow[];
  page?: number;
  limit?: number;
  total?: number;
}

interface RunDetail {
  run?: RunRow;
  events?: Record<string, unknown>[];
  [key: string]: unknown;
}

function rowsFrom(resp: ListRunsResponse | RunRow[]): RunRow[] {
  if (Array.isArray(resp)) return resp;
  return resp.data ?? resp.items ?? [];
}

export function registerRunsCommand(program: Command): void {
  const runs = program.command("runs").description("Inspect message-processing runs (via data-processing /api/v1/runs)");

  runs
    .command("list")
    .description("List recent runs")
    .option("--status <s>", "filter on currentStatus")
    .option("--feed <id>", "filter on dataFeedId")
    .option("--project <id>", "filter on projectId")
    .option("--since <iso>", "createdAt >= <iso> (mapped to dateFrom)")
    .option("--until <iso>", "createdAt <= <iso> (mapped to dateTo)")
    .option("--limit <n>", "max rows (capped at 200 server-side)", "50")
    .option("--page <n>", "page index", "0")
    .option("--sort-by <col>", "sort column", "createdAt")
    .option("--sort-dir <dir>", "sort direction (asc | desc)", "desc")
    .action(
      async (opts: {
        status?: string;
        feed?: string;
        project?: string;
        since?: string;
        until?: string;
        limit: string;
        page: string;
        sortBy: string;
        sortDir: string;
      }) => {
        const cmd = runs.commands.find((c) => c.name() === "list")!;
        const rt = loadRuntime(cmd);
        const res = await requestGateway<ListRunsResponse | RunRow[]>(rt.config, {
          path: "/data-processing/api/v1/runs",
          query: {
            page: opts.page,
            limit: opts.limit,
            sortBy: opts.sortBy,
            sortDir: opts.sortDir,
            status: opts.status,
            dataFeedId: opts.feed,
            projectId: opts.project,
            dateFrom: opts.since,
            dateTo: opts.until,
          },
        });
        emitArray(rowsFrom(res.data) as unknown as Record<string, unknown>[], rt.output);
      },
    );

  runs
    .command("get <runId>")
    .description("Run detail by messageId (with events + file hash)")
    .action(async (runId: string) => {
      const cmd = runs.commands.find((c) => c.name() === "get")!;
      const rt = loadRuntime(cmd);
      const res = await requestGateway<RunDetail>(rt.config, {
        path: `/data-processing/api/v1/runs/${encodeURIComponent(runId)}`,
      });
      if (rt.output.format === "json") {
        emitText(JSON.stringify(res.data, null, 2));
      } else {
        emitRow(res.data as unknown as Record<string, unknown>, rt.output);
      }
    });

  runs
    .command("follow <runId>")
    .description("Poll a run via the runs API until it reaches a terminal status (SUCCESS / FAILED / COMPLETED)")
    .option("--interval <s>", "poll interval in seconds", "2")
    .option("--timeout <s>", "give up after N seconds", "120")
    .action(async (runId: string, opts: { interval: string; timeout: string }) => {
      const cmd = runs.commands.find((c) => c.name() === "follow")!;
      const rt = loadRuntime(cmd);
      const intervalMs = (parseInt(opts.interval, 10) || 2) * 1_000;
      const deadline = Date.now() + (parseInt(opts.timeout, 10) || 120) * 1_000;
      const terminal = new Set(["SUCCESS", "FAILED", "COMPLETED", "ERROR"]);
      let lastSig = "";
      while (Date.now() < deadline) {
        const res = await requestGateway<RunDetail>(rt.config, {
          path: `/data-processing/api/v1/runs/${encodeURIComponent(runId)}`,
          expectStatus: [200, 404],
        });
        if (res.status === 404) {
          throw new CliError("NOT_FOUND", `Run not found: ${runId}`, { runId });
        }
        const run = (res.data.run ?? (res.data as unknown as RunRow)) as RunRow;
        const sig = `${run.currentStage ?? ""}:${run.currentStatus ?? ""}`;
        if (sig !== lastSig) {
          emitRow(
            {
              currentStage: run.currentStage,
              currentStatus: run.currentStatus,
              updatedAt: run.updatedAt,
              errorCode: run.errorCode,
              errorMessage: run.errorMessage,
            } as Record<string, unknown>,
            rt.output,
          );
          lastSig = sig;
        }
        if (run.currentStatus && terminal.has(run.currentStatus.toUpperCase())) return;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      throw new CliError("TIMEOUT", `Run did not reach terminal status within ${opts.timeout}s`, { runId });
    });

  runs
    .command("events <runId>")
    .description("Stream events for a run (extracted from runs/:messageId detail response)")
    .option("--stage <s>", "filter on stage")
    .action(async (runId: string, opts: { stage?: string }) => {
      const cmd = runs.commands.find((c) => c.name() === "events")!;
      const rt = loadRuntime(cmd);
      const res = await requestGateway<RunDetail>(rt.config, {
        path: `/data-processing/api/v1/runs/${encodeURIComponent(runId)}`,
      });
      const events = (res.data.events ?? []) as Record<string, unknown>[];
      const filtered = opts.stage ? events.filter((e) => e.stage === opts.stage) : events;
      emitArray(filtered, rt.output);
    });

  runs
    .command("replay <runId>")
    .description("Re-enqueue a failed run via /api/v1/runs/:messageId/retry (write-gated)")
    .option("--confirm", "actually perform the retry", false)
    .action(async (runId: string, opts: { confirm?: boolean }) => {
      const cmd = runs.commands.find((c) => c.name() === "replay")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) {
        throw new CliError("WRITE_NOT_CONFIRMED", `Replay is mutating. Re-run with --confirm.`, { runId });
      }
      const res = await requestGateway<Record<string, unknown>>(rt.config, {
        method: "POST",
        path: `/data-processing/api/v1/runs/${encodeURIComponent(runId)}/retry`,
        expectStatus: [200, 202],
      });
      emitText(JSON.stringify(res.data, null, 2));
    });

  runs
    .command("delete <runId>")
    .description("Soft-delete a run and purge its MinIO objects (write-gated)")
    .option("--confirm", "actually delete", false)
    .action(async (runId: string, opts: { confirm?: boolean }) => {
      const cmd = runs.commands.find((c) => c.name() === "delete")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) {
        throw new CliError("WRITE_NOT_CONFIRMED", `Delete is mutating. Re-run with --confirm.`, { runId });
      }
      const res = await requestGateway<Record<string, unknown>>(rt.config, {
        method: "DELETE",
        path: `/data-processing/api/v1/runs/${encodeURIComponent(runId)}`,
      });
      emitText(JSON.stringify(res.data, null, 2));
    });
}
