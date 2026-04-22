import initSqlJs from "sql.js";
import { logger } from "./logger";

/**
 * Convert a SQLite database Buffer to a JSON string of rows from the first
 * table found (prefers "Isolates", falls back to the first user table).
 * This runs in Node.js (not the plugin sandbox) so sql.js/WASM works fine.
 */
export async function convertSqliteToJson(
  buffer: Buffer,
  maxRows?: number,
): Promise<string> {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(buffer));

  // Find tables
  const tables = db
    .exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .flatMap((r: any) => r.values.map((v: any) => String(v[0])));

  const tableName =
    tables.find((t: string) => t.toLowerCase() === "isolates") || tables[0];
  if (!tableName) {
    db.close();
    throw new Error("SQLite database contains no tables");
  }

  const limitClause = maxRows ? ` LIMIT ${maxRows}` : "";
  const [result] = db.exec(`SELECT * FROM "${tableName}"${limitClause}`);

  // Get total count when limiting, for the log message
  let totalRows = result?.values?.length ?? 0;
  if (maxRows) {
    const [countResult] = db.exec(
      `SELECT COUNT(*) FROM "${tableName}"`,
    );
    totalRows = Number(countResult?.values?.[0]?.[0] ?? 0);
  }

  db.close();

  if (!result || result.values.length === 0) {
    return "[]";
  }

  const rows = result.values.map((vals: any[]) => {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < result.columns.length; i++) {
      row[result.columns[i]] = vals[i];
    }
    return row;
  });

  const limitNote = maxRows && totalRows > rows.length
    ? ` (limited to ${rows.length} of ${totalRows})`
    : "";
  logger.info(
    `SQLite pre-conversion: extracted ${rows.length} rows from "${tableName}" (${result.columns.length} columns)${limitNote}`,
  );

  return JSON.stringify(rows);
}
