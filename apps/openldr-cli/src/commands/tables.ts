import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray } from "../output.js";
import { query, type DbName } from "../clients/postgres.js";
import { execInContainer, parsePsqlJson } from "../clients/docker-exec.js";
import { CliError } from "../errors.js";

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
    .option("--internal", "run inside the openldr-postgres container via `docker exec psql`", false)
    .action(async (opts: { db?: string; internal?: boolean }) => {
      const cmd = program.commands.find((c) => c.name() === "tables")!;
      const rt = loadRuntime(cmd);
      const dbs: DbName[] = opts.db ? [opts.db as DbName] : ["openldr", "openldr_external"];
      const rows: Record<string, unknown>[] = [];
      for (const db of dbs) {
        if (opts.internal) {
          const dbName = db === "openldr" ? rt.config.postgres.database : rt.config.postgres.databaseExternal;
          const r = await execInContainer(
            rt.config.postgres.container,
            [
              "psql",
              "-tA",
              "-U",
              rt.config.postgres.user,
              "-d",
              dbName,
              "-c",
              `SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (${LIST_TABLES_SQL}) t`,
            ],
            { env: { PGPASSWORD: rt.config.postgres.password } },
          );
          if (r.exitCode !== 0) {
            throw new CliError("DB_QUERY_FAILED", r.stderr.trim(), { db, exitCode: r.exitCode });
          }
          const parsed = parsePsqlJson<Record<string, unknown>[]>(r.stdout);
          for (const row of parsed) rows.push({ db, ...row });
        } else {
          const result = await query<{ schema: string; name: string; approx_rows: string | number | null }>(
            rt.config,
            db,
            LIST_TABLES_SQL,
          );
          for (const r of result.rows) rows.push({ db, ...r });
        }
      }
      emitArray(rows, rt.output);
    });
}
