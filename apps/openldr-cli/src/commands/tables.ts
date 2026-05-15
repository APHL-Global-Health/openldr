import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray } from "../output.js";
import { query, type DbName } from "../clients/postgres.js";

const LIST_TABLES_SQL = `
SELECT
  table_schema AS schema,
  table_name AS name,
  (SELECT reltuples::bigint FROM pg_class WHERE relname = table_name AND relkind = 'r' LIMIT 1) AS approx_rows
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name
`;

export function registerTablesCommand(program: Command): void {
  program
    .command("tables")
    .description("List tables across both Postgres databases (openldr, openldr_external)")
    .option("--db <name>", "limit to one database (openldr | openldr_external)")
    .action(async (opts: { db?: string }) => {
      const cmd = program.commands.find((c) => c.name() === "tables")!;
      const rt = loadRuntime(cmd);
      const dbs: DbName[] = opts.db
        ? [opts.db as DbName]
        : ["openldr", "openldr_external"];
      const rows: Record<string, unknown>[] = [];
      for (const db of dbs) {
        const result = await query<{ schema: string; name: string; approx_rows: string | number | null }>(
          rt.config,
          db,
          LIST_TABLES_SQL,
        );
        for (const r of result.rows) rows.push({ db, ...r });
      }
      emitArray(rows, rt.output);
    });
}
