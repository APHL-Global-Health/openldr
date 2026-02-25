import { Pool, type PoolClient } from "pg";

const isDev = process.env.NODE_ENV === "development";

const sharedConfig = {
  host: isDev ? "localhost" : process.env.POSTGRES_HOSTNAME!,
  port:
    process.env.POSTGRES_PORT !== undefined
      ? parseInt(process.env.POSTGRES_PORT!) || 5432
      : 5432,
  user: process.env.POSTGRES_USER!,
  password: process.env.POSTGRES_PASSWORD!,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Internal database (openldr) — projects, facilities, dataFeeds, plugins, extensions, etc.
const pool = new Pool({
  ...sharedConfig,
  database: process.env.POSTGRES_DB!, // "openldr"
  max: 20,
});

// External database (openldr_external) — patients, lab_requests, lab_results
const externalPool = new Pool({
  ...sharedConfig,
  database: process.env.POSTGRES_DB_EXTERNAL!,
  max: 20,
});

// ── Query helpers ─────────────────────────────────────────────────────────

async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

async function queryExternal<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await externalPool.query(sql, params);
  return rows as T[];
}

async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

async function queryOneExternal<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await queryExternal<T>(sql, params);
  return rows[0] ?? null;
}

async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function withTransactionExternal<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await externalPool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export {
  pool,
  externalPool,
  query,
  queryExternal,
  queryOne,
  queryOneExternal,
  withTransaction,
  withTransactionExternal,
};
