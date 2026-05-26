import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray, emitText } from "../output.js";
import { query, isSelectOnly, type DbName } from "../clients/postgres.js";
import { CliError } from "../errors.js";
import { execInContainer, parsePsqlJson } from "../clients/docker-exec.js";

function escapeSingle(s: string): string {
  return s.replace(/'/g, "''");
}

async function runViaContainer(
  container: string,
  user: string,
  password: string,
  database: string,
  sql: string,
  wrapAsJson: boolean,
): Promise<unknown> {
  const finalSql = wrapAsJson ? `SELECT COALESCE(json_agg(row_to_json(t)), '[]') AS j FROM (${sql}) t` : sql;
  const r = await execInContainer(
    container,
    ["psql", "-tA", "-U", user, "-d", database, "-c", finalSql],
    { env: { PGPASSWORD: password } },
  );
  if (r.exitCode !== 0) {
    throw new CliError("DB_QUERY_FAILED", r.stderr.trim() || "psql exited non-zero", {
      container,
      exitCode: r.exitCode,
    });
  }
  return wrapAsJson ? parsePsqlJson<unknown[]>(r.stdout) : r.stdout;
}

export function registerDbCommand(program: Command): void {
  const db = program.command("db").description("Read SQL access to the Postgres databases");

  db
    .command("query <sql>")
    .description("Execute a SQL statement against one of the databases")
    .option("--db <name>", "openldr (default) | openldr_external", "openldr")
    .option("--allow-write", "permit non-SELECT statements (UPDATE/DELETE/INSERT etc.)", false)
    .option("--limit <n>", "row cap applied to result before serialization", "200")
    .option("--internal", "run inside the openldr-postgres container via `docker exec psql`", false)
    .action(
      async (
        sql: string,
        opts: { db: string; allowWrite?: boolean; limit: string; internal?: boolean },
      ) => {
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
        const limit = parseInt(opts.limit, 10) || 200;
        if (opts.internal) {
          const dbFinal =
            dbName === "openldr_external" ? rt.config.postgres.databaseExternal : rt.config.postgres.database;
          const rows = (await runViaContainer(
            rt.config.postgres.container,
            rt.config.postgres.user,
            rt.config.postgres.password,
            dbFinal,
            sql,
            isSelectOnly(sql),
          )) as Record<string, unknown>[];
          const sliced = Array.isArray(rows) ? rows.slice(0, limit) : [];
          emitArray(sliced, rt.output);
          if (Array.isArray(rows) && rows.length > limit) {
            process.stderr.write(JSON.stringify({ truncated_at: limit, total: rows.length }) + "\n");
          }
          return;
        }
        const result = await query(rt.config, dbName, sql, []);
        const rows = result.rows.slice(0, limit) as Record<string, unknown>[];
        emitArray(rows, rt.output);
        if (result.rows.length > limit) {
          process.stderr.write(JSON.stringify({ truncated_at: limit, total: result.rows.length }) + "\n");
        }
      },
    );

  db
    .command("explain <sql>")
    .description("Run EXPLAIN ANALYZE on a SELECT query")
    .option("--db <name>", "openldr | openldr_external", "openldr")
    .option("--internal", "run inside the openldr-postgres container", false)
    .action(async (sql: string, opts: { db: string; internal?: boolean }) => {
      const cmd = db.commands.find((c) => c.name() === "explain")!;
      const rt = loadRuntime(cmd);
      if (!isSelectOnly(sql)) {
        throw new CliError("NOT_SUPPORTED", "explain only supports SELECT-style queries", {
          sql: sql.slice(0, 200),
        });
      }
      if (opts.internal) {
        const dbFinal =
          opts.db === "openldr_external" ? rt.config.postgres.databaseExternal : rt.config.postgres.database;
        const r = await execInContainer(
          rt.config.postgres.container,
          [
            "psql",
            "-tA",
            "-U",
            rt.config.postgres.user,
            "-d",
            dbFinal,
            "-c",
            `EXPLAIN ANALYZE ${escapeSingle(sql)}`.replace(/^EXPLAIN ANALYZE /, "EXPLAIN ANALYZE "), // no-op normalize
          ],
          { env: { PGPASSWORD: rt.config.postgres.password } },
        );
        if (r.exitCode !== 0) {
          throw new CliError("DB_QUERY_FAILED", r.stderr.trim() || "psql exited non-zero", { exitCode: r.exitCode });
        }
        emitText(r.stdout);
        return;
      }
      const result = await query(rt.config, opts.db as DbName, `EXPLAIN ANALYZE ${sql}`, []);
      for (const row of result.rows) {
        emitText(Object.values(row)[0] as string);
      }
    });
}
