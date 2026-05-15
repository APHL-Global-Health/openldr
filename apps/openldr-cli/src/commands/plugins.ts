import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray, emitRow, emitText } from "../output.js";
import { query } from "../clients/postgres.js";
import { CliError } from "../errors.js";

export function registerPluginsCommand(program: Command): void {
  const plugins = program.command("plugins").description("Manage data-pipeline plugins");

  plugins
    .command("list")
    .description("List plugins")
    .option("--type <t>", "filter by pluginType (validation | mapping | storage | outpost)")
    .option("--status <s>", "filter by status (active | draft | inactive | deprecated)")
    .option("--limit <n>", "max rows", "100")
    .action(async (opts: { type?: string; status?: string; limit: string }) => {
      const cmd = plugins.commands.find((c) => c.name() === "list")!;
      const rt = loadRuntime(cmd);
      const where: string[] = [];
      const params: unknown[] = [];
      if (opts.type) { params.push(opts.type); where.push(`"pluginType" = $${params.length}`); }
      if (opts.status) { params.push(opts.status); where.push(`"status" = $${params.length}`); }
      params.push(parseInt(opts.limit, 10) || 100);
      const sql = `SELECT * FROM plugins ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY "updatedAt" DESC LIMIT $${params.length}`;
      const result = await query(rt.config, "openldr", sql, params);
      emitArray(result.rows as Record<string, unknown>[], rt.output);
    });

  plugins
    .command("get <id>")
    .description("Plugin detail by id")
    .action(async (id: string) => {
      const cmd = plugins.commands.find((c) => c.name() === "get")!;
      const rt = loadRuntime(cmd);
      const result = await query(rt.config, "openldr", `SELECT * FROM plugins WHERE id = $1`, [id]);
      if (result.rowCount === 0) throw new CliError("NOT_FOUND", `Plugin not found: ${id}`, { id });
      emitRow(result.rows[0] as Record<string, unknown>, rt.output);
    });

  plugins
    .command("enable <id>")
    .description("Set plugin status to active (write-gated)")
    .option("--confirm", "actually update", false)
    .action(async (id: string, opts: { confirm?: boolean }) => {
      const cmd = plugins.commands.find((c) => c.name() === "enable")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) throw new CliError("WRITE_NOT_CONFIRMED", "Re-run with --confirm.", { id });
      const result = await query(rt.config, "openldr", `UPDATE plugins SET status = 'active' WHERE id = $1 RETURNING id, status`, [id]);
      if (result.rowCount === 0) throw new CliError("NOT_FOUND", `Plugin not found: ${id}`, { id });
      emitText(JSON.stringify(result.rows[0]));
    });

  plugins
    .command("disable <id>")
    .description("Set plugin status to inactive (write-gated)")
    .option("--confirm", "actually update", false)
    .action(async (id: string, opts: { confirm?: boolean }) => {
      const cmd = plugins.commands.find((c) => c.name() === "disable")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) throw new CliError("WRITE_NOT_CONFIRMED", "Re-run with --confirm.", { id });
      const result = await query(rt.config, "openldr", `UPDATE plugins SET status = 'inactive' WHERE id = $1 RETURNING id, status`, [id]);
      if (result.rowCount === 0) throw new CliError("NOT_FOUND", `Plugin not found: ${id}`, { id });
      emitText(JSON.stringify(result.rows[0]));
    });
}
