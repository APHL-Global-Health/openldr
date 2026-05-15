import { Pool, type QueryResult, type QueryResultRow } from "pg";
import type { LoadedConfig } from "../config.js";
import { CliError } from "../errors.js";

export type DbName = "openldr" | "openldr_external";

const pools = new Map<DbName, Pool>();

export function getPool(cfg: LoadedConfig, db: DbName): Pool {
  const existing = pools.get(db);
  if (existing) return existing;
  const database = db === "openldr" ? cfg.postgres.database : cfg.postgres.databaseExternal;
  const pool = new Pool({
    host: cfg.postgres.host,
    port: cfg.postgres.port,
    user: cfg.postgres.user,
    password: cfg.postgres.password,
    database,
    max: 4,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
  });
  pool.on("error", () => {
    // suppress unhandled error events from idle clients; commands surface
    // their own connection failures
  });
  pools.set(db, pool);
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  cfg: LoadedConfig,
  db: DbName,
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const pool = getPool(cfg, db);
  try {
    return await pool.query<T>(sql, params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(msg)) {
      throw new CliError("DB_CONNECT_FAILED", `Postgres connection failed: ${msg}`, {
        host: cfg.postgres.host,
        port: cfg.postgres.port,
        db,
      });
    }
    throw new CliError("DB_QUERY_FAILED", msg, { db });
  }
}

export async function closeAllPools(): Promise<void> {
  for (const pool of pools.values()) {
    try {
      await pool.end();
    } catch {
      // best effort
    }
  }
  pools.clear();
}

export function isSelectOnly(sql: string): boolean {
  const stripped = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (stripped.length === 0) return false;
  const first = stripped.split(/\s+/)[0]?.toLowerCase() ?? "";
  return first === "select" || first === "with" || first === "explain" || first === "show";
}
