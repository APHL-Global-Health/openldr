import type { Command } from "commander";
import { loadRuntime, emitMetaIfNotQuiet } from "../runtime.js";
import { emitArray, emitRow, emitText } from "../output.js";
import { query } from "../clients/postgres.js";
import { CliError } from "../errors.js";

const RUNS_COLS = `
  "id","messageId","projectId","dataFeedId","userId",
  "currentStage","currentStatus","outpostStatus",
  "errorStage","errorCode","errorMessage",
  "rawObjectPath","validatedObjectPath","mappedObjectPath","processedObjectPath",
  "createdAt","updatedAt","completedAt"
`;

export function registerRunsCommand(program: Command): void {
  const runs = program.command("runs").description("Inspect messageProcessingRuns / events");

  runs
    .command("list")
    .description("List recent runs (most recent first)")
    .option("--status <s>", "filter on currentStatus (e.g. SUCCESS, FAILED, IN_PROGRESS)")
    .option("--stage <s>", "filter on currentStage")
    .option("--feed <id>", "filter on dataFeedId")
    .option("--since <iso>", "createdAt >= <iso>")
    .option("--limit <n>", "max rows", "50")
    .action(async (opts: { status?: string; stage?: string; feed?: string; since?: string; limit: string }) => {
      const cmd = runs.commands.find((c) => c.name() === "list")!;
      const rt = loadRuntime(cmd);
      const where: string[] = [];
      const params: unknown[] = [];
      if (opts.status) { params.push(opts.status); where.push(`"currentStatus" = $${params.length}`); }
      if (opts.stage) { params.push(opts.stage); where.push(`"currentStage" = $${params.length}`); }
      if (opts.feed) { params.push(opts.feed); where.push(`"dataFeedId" = $${params.length}`); }
      if (opts.since) { params.push(opts.since); where.push(`"createdAt" >= $${params.length}`); }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      params.push(parseInt(opts.limit, 10) || 50);
      const sql = `SELECT ${RUNS_COLS} FROM "messageProcessingRuns" ${whereSql} ORDER BY "createdAt" DESC LIMIT $${params.length}`;
      const result = await query(rt.config, "openldr", sql, params);
      emitArray(result.rows as Record<string, unknown>[], rt.output);
    });

  runs
    .command("get <runId>")
    .description("Single run by id OR messageId, with all joined events")
    .action(async (runId: string) => {
      const cmd = runs.commands.find((c) => c.name() === "get")!;
      const rt = loadRuntime(cmd);
      const isUuid = /^[0-9a-f-]{36}$/i.test(runId);
      if (!isUuid) {
        throw new CliError("USAGE", "runId must be a UUID (matches id or messageId)", { runId });
      }
      const runSql = `SELECT ${RUNS_COLS} FROM "messageProcessingRuns" WHERE "id" = $1 OR "messageId" = $1 LIMIT 1`;
      const run = await query(rt.config, "openldr", runSql, [runId]);
      if (run.rowCount === 0) {
        throw new CliError("NOT_FOUND", `Run not found: ${runId}`, { runId });
      }
      const row = run.rows[0] as { messageId: string };
      const events = await query(
        rt.config,
        "openldr",
        `SELECT "id","stage","status","eventType","topic","objectPath","pluginName","pluginVersion","errorCode","errorMessage","errorDetails","metadata","createdAt"
         FROM "messageProcessingEvents" WHERE "messageId" = $1 ORDER BY "createdAt" ASC`,
        [row.messageId],
      );
      if (rt.output.format === "json" || rt.output.format === "table") {
        emitText(JSON.stringify({ run: row, events: events.rows }, null, 2));
      } else {
        emitRow(row as Record<string, unknown>, rt.output);
        emitMetaIfNotQuiet(rt, { events: events.rowCount });
        for (const ev of events.rows) emitRow(ev as Record<string, unknown>, rt.output);
      }
    });

  runs
    .command("follow <runId>")
    .description("Poll a run until it reaches a terminal status (SUCCESS, FAILED)")
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
        const result = await query<{ currentStage: string; currentStatus: string; errorMessage: string | null; updatedAt: Date }>(
          rt.config,
          "openldr",
          `SELECT "currentStage","currentStatus","errorMessage","updatedAt"
           FROM "messageProcessingRuns" WHERE "id" = $1 OR "messageId" = $1 LIMIT 1`,
          [runId],
        );
        if (result.rowCount === 0) {
          throw new CliError("NOT_FOUND", `Run not found: ${runId}`, { runId });
        }
        const row = result.rows[0]!;
        const sig = `${row.currentStage}:${row.currentStatus}`;
        if (sig !== lastSig) {
          emitRow(row as unknown as Record<string, unknown>, rt.output);
          lastSig = sig;
        }
        if (terminal.has(row.currentStatus.toUpperCase())) return;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      throw new CliError("TIMEOUT", `Run did not reach a terminal status within ${opts.timeout}s`, { runId });
    });

  runs
    .command("events <runId>")
    .description("Stream messageProcessingEvents for a run")
    .option("--stage <s>", "filter on stage")
    .action(async (runId: string, opts: { stage?: string }) => {
      const cmd = runs.commands.find((c) => c.name() === "events")!;
      const rt = loadRuntime(cmd);
      const run = await query<{ messageId: string }>(
        rt.config,
        "openldr",
        `SELECT "messageId" FROM "messageProcessingRuns" WHERE "id" = $1 OR "messageId" = $1 LIMIT 1`,
        [runId],
      );
      if (run.rowCount === 0) throw new CliError("NOT_FOUND", `Run not found: ${runId}`, { runId });
      const params: unknown[] = [run.rows[0]!.messageId];
      let stageClause = "";
      if (opts.stage) {
        params.push(opts.stage);
        stageClause = ` AND "stage" = $${params.length}`;
      }
      const result = await query(
        rt.config,
        "openldr",
        `SELECT * FROM "messageProcessingEvents" WHERE "messageId" = $1 ${stageClause} ORDER BY "createdAt" ASC`,
        params,
      );
      emitArray(result.rows as Record<string, unknown>[], rt.output);
    });

  runs
    .command("replay <runId>")
    .description("Re-enqueue a failed run via the data-processing retry endpoint (write-gated)")
    .option("--confirm", "actually perform the retry", false)
    .action(async (runId: string, opts: { confirm?: boolean }) => {
      const cmd = runs.commands.find((c) => c.name() === "replay")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) {
        throw new CliError(
          "WRITE_NOT_CONFIRMED",
          `Replay is a mutating operation. Re-run with --confirm to actually retry run ${runId}.`,
          { runId },
        );
      }
      const { requestGateway } = await import("../clients/gateway.js");
      const res = await requestGateway(rt.config, {
        method: "POST",
        path: `/data-processing/api/v1/runs/${runId}/retry`,
      });
      emitText(JSON.stringify({ status: res.status, data: res.data }, null, 2));
    });
}
