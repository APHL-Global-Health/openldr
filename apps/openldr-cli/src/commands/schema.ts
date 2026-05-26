import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray } from "../output.js";
import { query, type DbName } from "../clients/postgres.js";
import { execInContainer, parsePsqlJson } from "../clients/docker-exec.js";
import { CliError } from "../errors.js";

const COLUMNS_SQL = `
SELECT
  c.column_name AS name,
  c.data_type AS type,
  c.is_nullable AS nullable,
  c.column_default AS default_value,
  c.character_maximum_length AS max_length
FROM information_schema.columns c
WHERE c.table_name = $$TABLE_NAME$$
  AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY c.ordinal_position
`;

export function registerSchemaCommand(program: Command): void {
  program
    .command("schema <table>")
    .description("Column-by-column schema for one table")
    .option("--db <name>", "database to query (openldr | openldr_external)", "openldr")
    .option("--internal", "run inside the openldr-postgres container", false)
    .action(async (table: string, opts: { db: string; internal?: boolean }) => {
      const cmd = program.commands.find((c) => c.name() === "schema")!;
      const rt = loadRuntime(cmd);
      const db = opts.db as DbName;
      if (!/^[a-zA-Z0-9_]+$/.test(table)) {
        throw new CliError("USAGE", `invalid table name: ${table}`, { table });
      }
      if (opts.internal) {
        const dbName = db === "openldr" ? rt.config.postgres.database : rt.config.postgres.databaseExternal;
        const sql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (${COLUMNS_SQL.replace("$$TABLE_NAME$$", `'${table}'`)}) t`;
        const r = await execInContainer(
          rt.config.postgres.container,
          ["psql", "-tA", "-U", rt.config.postgres.user, "-d", dbName, "-c", sql],
          { env: { PGPASSWORD: rt.config.postgres.password } },
        );
        if (r.exitCode !== 0) {
          throw new CliError("DB_QUERY_FAILED", r.stderr.trim(), { table, exitCode: r.exitCode });
        }
        const rows = parsePsqlJson<Record<string, unknown>[]>(r.stdout);
        if (rows.length === 0) {
          throw new CliError("NOT_FOUND", `Table not found: ${table} (db=${db})`, { table, db });
        }
        emitArray(rows, rt.output);
        return;
      }
      const result = await query(rt.config, db, COLUMNS_SQL.replace("$$TABLE_NAME$$", "$1"), [table]);
      if (result.rowCount === 0) {
        throw new CliError("NOT_FOUND", `Table not found: ${table} (db=${db})`, { table, db });
      }
      emitArray(result.rows as Record<string, unknown>[], rt.output);
    });
}
