import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray } from "../output.js";
import { query, type DbName } from "../clients/postgres.js";
import { CliError } from "../errors.js";

const COLUMNS_SQL = `
SELECT
  c.column_name AS name,
  c.data_type AS type,
  c.is_nullable AS nullable,
  c.column_default AS default_value,
  c.character_maximum_length AS max_length
FROM information_schema.columns c
WHERE c.table_name = $1
  AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY c.ordinal_position
`;

export function registerSchemaCommand(program: Command): void {
  program
    .command("schema <table>")
    .description("Column-by-column schema for one table")
    .option("--db <name>", "database to query (openldr | openldr_external)", "openldr")
    .action(async (table: string, opts: { db: string }) => {
      const cmd = program.commands.find((c) => c.name() === "schema")!;
      const rt = loadRuntime(cmd);
      const db = opts.db as DbName;
      const result = await query(rt.config, db, COLUMNS_SQL, [table]);
      if (result.rowCount === 0) {
        throw new CliError("NOT_FOUND", `Table not found: ${table} (db=${db})`, { table, db });
      }
      emitArray(result.rows as Record<string, unknown>[], rt.output);
    });
}
