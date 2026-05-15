import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray, emitText } from "../output.js";
import { query, isSelectOnly, type DbName } from "../clients/postgres.js";
import { CliError } from "../errors.js";

export function registerDbCommand(program: Command): void {
  const db = program.command("db").description("Read SQL access to the Postgres databases");

  db
    .command("query <sql>")
    .description("Execute a SQL statement against one of the databases")
    .option("--db <name>", "openldr (default) | openldr_external", "openldr")
    .option("--allow-write", "permit non-SELECT statements (UPDATE/DELETE/INSERT etc.)", false)
    .option("--limit <n>", "row cap applied to result before serialization", "200")
    .action(async (sql: string, opts: { db: string; allowWrite?: boolean; limit: string }) => {
      const cmd = db.commands.find((c) => c.name() === "query")!;
      const rt = loadRuntime(cmd);
      const dbName = opts.db as DbName;
      if (!opts.allowWrite && !isSelectOnly(sql)) {
        throw new CliError(
          "WRITE_NOT_CONFIRMED",
          "Non-SELECT statement rejected. Re-run with --allow-write to permit writes.",
          { sql: sql.slice(0, 200) },
        );
      }
      const result = await query(rt.config, dbName, sql, []);
      const limit = parseInt(opts.limit, 10) || 200;
      const rows = result.rows.slice(0, limit) as Record<string, unknown>[];
      emitArray(rows, rt.output);
      if (result.rows.length > limit) {
        process.stderr.write(JSON.stringify({ truncated_at: limit, total: result.rows.length }) + "\n");
      }
    });

  db
    .command("explain <sql>")
    .description("Run EXPLAIN ANALYZE on a SELECT query")
    .option("--db <name>", "openldr | openldr_external", "openldr")
    .action(async (sql: string, opts: { db: string }) => {
      const cmd = db.commands.find((c) => c.name() === "explain")!;
      const rt = loadRuntime(cmd);
      if (!isSelectOnly(sql)) {
        throw new CliError("NOT_SUPPORTED", "explain only supports SELECT-style queries", { sql: sql.slice(0, 200) });
      }
      const result = await query(rt.config, opts.db as DbName, `EXPLAIN ANALYZE ${sql}`, []);
      for (const row of result.rows) {
        emitText(Object.values(row)[0] as string);
      }
    });
}
