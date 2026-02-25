// ─────────────────────────────────────────────────────────────────────────────
// Translates extension SDK query params into safe SQL
//
// Supports:
//   Equality:   { facility_code: 'FAC001' }
//   Operators:  { created_at: { gte: '2024-01-01', lte: '2024-12-31' } }
//               { rpt_flag: { in: ['H', 'L'] } }
//               { observation_desc: { like: 'glucose%' } }
//               { status: { ne: 'cancelled' } }
//   Pagination: page, limit (max 500)
//   Sort:       { field, direction }
//
// JSONB:
//   Fields not in a table's top-level column list are automatically
//   routed to the table's JSONB column (patient_data, request_data, result_data).
//   Returned rows have their JSONB column merged into the top level so
//   extensions receive flat objects and don't need to know about JSONB.
// ─────────────────────────────────────────────────────────────────────────────

import { queryExternal } from "./db";

// ── Table definitions ─────────────────────────────────────────────────────
// Lists which columns are real top-level columns vs live inside a JSONB blob.
// Any filter/sort key not in topLevelColumns is routed to the jsonbColumn.

interface TableDef {
  table: string;
  primaryKey: string;
  topLevelColumns: Set<string>;
  jsonbColumn: string | null; // null = no JSONB column on this table
  // Columns to always exclude from SELECT (internal keys, large blobs)
  excludeColumns: Set<string>;
}

const TABLE_DEFS: Record<string, TableDef> = {
  patients: {
    table: "patients",
    primaryKey: "patients_id",
    topLevelColumns: new Set([
      "patients_id",
      "patient_id",
      "facility_code",
      "facility_id",
      "facility_name",
      "created_at",
      "updated_at",
    ]),
    jsonbColumn: "patient_data",
    excludeColumns: new Set(["patient_data"]), // merged in, not returned raw
  },
  lab_requests: {
    table: "lab_requests",
    primaryKey: "lab_requests_id",
    topLevelColumns: new Set([
      "lab_requests_id",
      "request_id",
      "facility_code",
      "facility_id",
      "facility_name",
      "patient_id",
      "obr_set_id",
      "panel_code",
      "panel_desc",
      "specimen_datetime",
      "created_at",
      "updated_at",
    ]),
    jsonbColumn: "request_data",
    excludeColumns: new Set(["request_data", "mappings"]),
  },
  lab_results: {
    table: "lab_results",
    primaryKey: "lab_results_id",
    topLevelColumns: new Set([
      "lab_results_id",
      "lab_requests_id",
      "obx_set_id",
      "observation_code",
      "observation_desc",
      "rpt_result",
      "rpt_units",
      "rpt_flag",
      "result_timestamp",
      "created_at",
      "updated_at",
    ]),
    jsonbColumn: "result_data",
    excludeColumns: new Set(["result_data"]),
  },
};

// ── Filter value shapes ───────────────────────────────────────────────────

type ScalarFilter = string | number | boolean | null;

interface OperatorFilter {
  eq?: ScalarFilter;
  ne?: ScalarFilter;
  gt?: ScalarFilter;
  gte?: ScalarFilter;
  lt?: ScalarFilter;
  lte?: ScalarFilter;
  like?: string;
  in?: ScalarFilter[];
}

type FilterValue = ScalarFilter | OperatorFilter;

export interface QueryParams {
  filters?: Record<string, FilterValue>;
  page?: number;
  limit?: number;
  sort?: { field: string; direction: "asc" | "desc" };
}

export interface QueryResult<T = Record<string, unknown>> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Column reference builder ──────────────────────────────────────────────
// Returns either `"column"` or `jsonbCol->>'key'` depending on table def.

function colRef(def: TableDef, key: string): string {
  if (def.topLevelColumns.has(key)) {
    return `"${key}"`;
  }
  if (def.jsonbColumn) {
    return `"${def.jsonbColumn}"->>'${key}'`;
  }
  // Unknown column and no JSONB — will cause a safe SQL error
  return `"${key}"`;
}

// ── WHERE clause builder ──────────────────────────────────────────────────

function buildWhere(
  def: TableDef,
  filters: Record<string, FilterValue>,
  params: unknown[],
): string {
  const clauses: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    const col = colRef(def, key);

    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      // Operator filter
      const ops = value as OperatorFilter;

      if (ops.eq !== undefined) {
        params.push(ops.eq);
        clauses.push(`${col} = $${params.length}`);
      }
      if (ops.ne !== undefined) {
        params.push(ops.ne);
        clauses.push(`${col} != $${params.length}`);
      }
      if (ops.gt !== undefined) {
        params.push(ops.gt);
        clauses.push(`${col} > $${params.length}`);
      }
      if (ops.gte !== undefined) {
        params.push(ops.gte);
        clauses.push(`${col} >= $${params.length}`);
      }
      if (ops.lt !== undefined) {
        params.push(ops.lt);
        clauses.push(`${col} < $${params.length}`);
      }
      if (ops.lte !== undefined) {
        params.push(ops.lte);
        clauses.push(`${col} <= $${params.length}`);
      }
      if (ops.like !== undefined) {
        params.push(ops.like);
        clauses.push(`${col} ILIKE $${params.length}`);
      }
      if (ops.in !== undefined && ops.in.length > 0) {
        params.push(ops.in);
        clauses.push(`${col} = ANY($${params.length})`);
      }
    } else {
      // Scalar equality
      params.push(value);
      clauses.push(`${col} = $${params.length}`);
    }
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
}

// ── ORDER BY builder ──────────────────────────────────────────────────────

function buildOrderBy(
  def: TableDef,
  sort?: { field: string; direction: "asc" | "desc" },
): string {
  if (!sort) return `ORDER BY "${def.primaryKey}" DESC`;
  const dir = sort.direction === "asc" ? "ASC" : "DESC";
  return `ORDER BY ${colRef(def, sort.field)} ${dir}`;
}

// ── Row flattener ─────────────────────────────────────────────────────────
// Merges the JSONB blob into the row and removes the raw JSONB key.

function flattenRow(
  def: TableDef,
  row: Record<string, unknown>,
): Record<string, unknown> {
  if (!def.jsonbColumn) return row;

  const jsonbData = row[def.jsonbColumn];
  const flat = { ...row };

  // Merge JSONB fields, but don't overwrite top-level columns
  if (jsonbData && typeof jsonbData === "object" && !Array.isArray(jsonbData)) {
    for (const [k, v] of Object.entries(jsonbData as Record<string, unknown>)) {
      if (!(k in flat)) flat[k] = v;
    }
  }

  // Remove raw JSONB columns and any excluded columns
  for (const excl of def.excludeColumns) {
    delete flat[excl];
  }

  return flat;
}

// ── Main query function ───────────────────────────────────────────────────

export async function runQuery<T = Record<string, unknown>>(
  schema: string,
  table: string,
  params: QueryParams,
): Promise<QueryResult<T>> {
  // Validate table
  const def = TABLE_DEFS[table];
  if (!def) {
    throw new Error(`Unknown table: ${schema}.${table}`);
  }

  // Validate schema — only 'external' supported in direct mode
  if (schema !== "external") {
    throw new Error(`Schema '${schema}' not supported in direct query mode`);
  }

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(500, Math.max(1, params.limit ?? 100));
  const offset = (page - 1) * limit;

  const queryParams: unknown[] = [];
  const where = buildWhere(def, params.filters ?? {}, queryParams);
  const orderBy = buildOrderBy(def, params.sort);

  // COUNT query (reuses same params up to where clause)
  const countParams = [...queryParams];
  const countSql = `SELECT COUNT(*) AS total FROM "${def.table}" ${where}`;

  // Data query — include JSONB column so we can flatten it
  const selectCols = def.jsonbColumn ? `*, "${def.jsonbColumn}"` : "*";

  queryParams.push(limit, offset);
  const dataSql = `
    SELECT ${selectCols}
    FROM "${def.table}"
    ${where}
    ${orderBy}
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
  `;

  const [countRows, dataRows] = await Promise.all([
    queryExternal<{ total: string }>(countSql, countParams),
    queryExternal<Record<string, unknown>>(dataSql, queryParams),
  ]);

  const total = parseInt(countRows[0]?.total ?? "0", 10);
  const data = dataRows.map((row) => flattenRow(def, row)) as T[];

  return { data, total, page, limit };
}
