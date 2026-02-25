import { pool, externalPool } from "../lib/db";
import { createLogger } from "../lib/logger";
import { formatUptime } from "../lib/utils";
import * as minioService from "../services/minio.service";
import type { PoolClient } from "pg";
import net from "net";

const logger = createLogger("dashboard");

// ============================================================
// Types
// ============================================================

interface DashboardFilters {
  startDateTime: string;
  endDateTime: string;
  facilityCode?: string;
  projectId?: string;
  useCaseId?: string;
}

interface ServiceHealthResult {
  name: string;
  displayName: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  responseTimeMs?: number;
  uptime?: string;
  version?: string;
  details?: Record<string, string | number>;
}

// ============================================================
// Helpers
// ============================================================

async function timedQuery<T = any>(
  client: PoolClient,
  text: string,
  params: any[] = [],
): Promise<{ rows: T[]; duration: number }> {
  const start = Date.now();
  const result = await client.query(text, params);
  return { rows: result.rows as T[], duration: Date.now() - start };
}

async function probeService(
  url: string,
  timeoutMs: number = 5000,
): Promise<{ ok: boolean; responseTimeMs: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, responseTimeMs: Date.now() - start };
  } catch {
    return { ok: false, responseTimeMs: Date.now() - start };
  }
}

/**
 * TCP-level probe: checks if a host:port is reachable.
 * Use for services behind self-signed TLS where HTTP fetch would fail.
 */
async function tcpProbe(
  host: string,
  port: number,
  timeoutMs: number = 5000,
): Promise<{ ok: boolean; responseTimeMs: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, responseTimeMs: Date.now() - start });
    }, timeoutMs);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: true, responseTimeMs: Date.now() - start });
    });

    socket.on("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: false, responseTimeMs: Date.now() - start });
    });
  });
}

/**
 * Build parameterized WHERE conditions for openldr_external.lab_requests.
 *
 * Columns used (from 02-openldr_external.sql):
 *   specimen_datetime  TIMESTAMP
 *   facility_code      VARCHAR(100)
 */
function buildRequestFilters(
  _filters: DashboardFilters,
  _tableAlias?: string,
  _paramOffset: number = 0,
): { conditions: string[]; params: any[] } {
  // const p = tableAlias ? `${tableAlias}.` : "";
  const conditions: string[] = [];
  const params: any[] = [];
  // let idx = paramOffset + 1;

  // if (filters.startDateTime) {
  //   conditions.push(`${p}specimen_datetime >= $${idx}`);
  //   params.push(filters.startDateTime);
  //   idx++;
  // }
  // if (filters.endDateTime) {
  //   conditions.push(`${p}specimen_datetime <= $${idx}`);
  //   params.push(filters.endDateTime);
  //   idx++;
  // }
  // if (filters.facilityCode) {
  //   conditions.push(`${p}facility_code = $${idx}`);
  //   params.push(filters.facilityCode);
  //   idx++;
  // }

  return { conditions, params };
}

function toWhere(conditions: string[]): string {
  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

// ============================================================
// KPI (openldr_external: patients, lab_requests, lab_results)
// ============================================================

export async function getKPI(
  ext: PoolClient,
  filters: DashboardFilters,
): Promise<any> {
  // Patients — only filter by facility_code (no time dimension on patients)
  const patientParams: any[] = [];
  let patientWhere = "";
  if (filters.facilityCode) {
    patientWhere = "WHERE facility_code = $1";
    patientParams.push(filters.facilityCode);
  }

  const { conditions: reqCond, params: reqParams } =
    buildRequestFilters(filters);
  const reqWhere = toWhere(reqCond);

  const { conditions: resCond, params: resParams } = buildRequestFilters(
    filters,
    "lrq",
  );
  const resWhere = toWhere(resCond);

  const [patients, requests, results] = await Promise.all([
    timedQuery(
      ext,
      `SELECT COUNT(*)::int AS count FROM patients ${patientWhere}`,
      patientParams,
    ),
    timedQuery(
      ext,
      `SELECT COUNT(*)::int AS count FROM lab_requests ${reqWhere}`,
      reqParams,
    ),
    timedQuery(
      ext,
      `SELECT COUNT(*)::int AS count
       FROM lab_results lr
       JOIN lab_requests lrq ON lr.lab_requests_id = lrq.lab_requests_id
       ${resWhere}`,
      resParams,
    ),
  ]);

  return {
    totalPatients: patients.rows[0]?.count ?? 0,
    totalLabRequests: requests.rows[0]?.count ?? 0,
    totalLabResults: results.rows[0]?.count ?? 0,
  };
}

// ============================================================
// Lab Activity Over Time (openldr_external)
// ============================================================

export async function getLabActivity(
  ext: PoolClient,
  filters: DashboardFilters,
): Promise<any[]> {
  const rangeMs =
    new Date(filters.endDateTime).getTime() -
    new Date(filters.startDateTime).getTime();
  // ≤1 day → hourly, ≤7 days → 4-hourly, else daily
  const truncUnit =
    rangeMs <= 86_400_000 ? "hour" : rangeMs <= 604_800_000 ? "hour" : "day";

  const { conditions, params } = buildRequestFilters(filters);
  const w = toWhere(conditions);

  const { conditions: resCond, params: resParams } = buildRequestFilters(
    filters,
    "lrq",
  );
  const resW = toWhere(resCond);

  // Two parallel queries, merge in JS (avoids CTE param-numbering issues)
  const [reqRows, resRows] = await Promise.all([
    timedQuery(
      ext,
      `SELECT date_trunc('${truncUnit}', specimen_datetime) AS bucket,
              COUNT(*)::int AS requests
       FROM lab_requests ${w}
       GROUP BY bucket ORDER BY bucket`,
      params,
    ),
    timedQuery(
      ext,
      `SELECT date_trunc('${truncUnit}', lrq.specimen_datetime) AS bucket,
              COUNT(*)::int AS results
       FROM lab_results lr
       JOIN lab_requests lrq ON lr.lab_requests_id = lrq.lab_requests_id
       ${resW}
       GROUP BY bucket ORDER BY bucket`,
      resParams,
    ),
  ]);

  const map = new Map<
    string,
    { timestamp: string; requests: number; results: number }
  >();

  for (const r of reqRows.rows as any[]) {
    const key = new Date(r.bucket).toISOString();
    map.set(key, { timestamp: key, requests: r.requests, results: 0 });
  }
  for (const r of resRows.rows as any[]) {
    const key = new Date(r.bucket).toISOString();
    const existing = map.get(key);
    if (existing) {
      existing.results = r.results;
    } else {
      map.set(key, { timestamp: key, requests: 0, results: r.results });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

// ============================================================
// Specimen Type Distribution (openldr_external)
//
// request_data JSONB on lab_requests may contain SpecimenType.
// ============================================================

export async function getSpecimenDistribution(
  ext: PoolClient,
  filters: DashboardFilters,
): Promise<any[]> {
  const { conditions, params } = buildRequestFilters(filters);
  const w = toWhere(conditions);

  const sql = `
    WITH specimens AS (
      SELECT
        COALESCE(
          request_data->>'SpecimenType',
          request_data->>'specimen_type',
          'Unknown'
        ) AS specimen_type,
        COUNT(*)::int AS count
      FROM lab_requests
      ${w}
      GROUP BY specimen_type
    ),
    total AS (SELECT NULLIF(SUM(count), 0)::float AS total FROM specimens)
    SELECT
      s.specimen_type AS "specimenType",
      s.specimen_type AS label,
      s.count,
      ROUND((s.count / t.total * 100)::numeric, 1)::float AS percentage
    FROM specimens s, total t
    WHERE t.total IS NOT NULL
    ORDER BY s.count DESC
    LIMIT 15
  `;

  const { rows } = await timedQuery(ext, sql, params);
  return rows;
}

// ============================================================
// Test Panel Volume (openldr_external)
//
// Columns: panel_code VARCHAR(100), panel_desc VARCHAR(255)
// ============================================================

export async function getTestPanelVolume(
  ext: PoolClient,
  filters: DashboardFilters,
): Promise<any[]> {
  const { conditions, params } = buildRequestFilters(filters);
  const w = toWhere(conditions);

  const sql = `
    SELECT
      COALESCE(panel_code, 'Unknown') AS "panelCode",
      COALESCE(panel_desc, panel_code, 'Unknown') AS "panelDesc",
      COUNT(*)::int AS count
    FROM lab_requests
    ${w}
    GROUP BY panel_code, panel_desc
    ORDER BY count DESC
    LIMIT 15
  `;

  const { rows } = await timedQuery(ext, sql, params);
  return rows;
}

// ============================================================
// Result Flag Distribution (openldr_external)
//
// Column: lab_results.rpt_flag VARCHAR(10)
// ============================================================

const FLAG_META: Record<string, { label: string; color: string }> = {
  N: { label: "Normal", color: "#22c55e" },
  H: { label: "High", color: "#ef4444" },
  L: { label: "Low", color: "#3b82f6" },
  A: { label: "Abnormal", color: "#f59e0b" },
  R: { label: "Resistant", color: "#dc2626" },
  S: { label: "Susceptible", color: "#16a34a" },
  I: { label: "Intermediate", color: "#f97316" },
};

export async function getResultFlagDistribution(
  ext: PoolClient,
  filters: DashboardFilters,
): Promise<any[]> {
  const { conditions, params } = buildRequestFilters(filters, "lrq");
  const w = toWhere(conditions);

  const sql = `
    SELECT
      COALESCE(UPPER(TRIM(lr.rpt_flag)), 'N') AS flag,
      COUNT(*)::int AS count
    FROM lab_results lr
    JOIN lab_requests lrq ON lr.lab_requests_id = lrq.lab_requests_id
    ${w}
    GROUP BY flag
    ORDER BY count DESC
  `;

  const { rows } = await timedQuery(ext, sql, params);
  return (rows as any[]).map((r) => ({
    flag: r.flag,
    label: FLAG_META[r.flag]?.label ?? r.flag,
    count: r.count,
    color: FLAG_META[r.flag]?.color ?? "#94a3b8",
  }));
}

// ============================================================
// Facility Activity (openldr_external + openldr for countryCode)
//
// Enriches with countryCode from openldr.facilities via facilityCode.
// ============================================================

export async function getFacilityActivity(
  ext: PoolClient,
  filters: DashboardFilters,
  intClient?: PoolClient,
): Promise<any[]> {
  const { conditions, params } = buildRequestFilters(filters, "lrq");
  const w = toWhere(conditions);

  const sql = `
    SELECT
      lrq.facility_code  AS "facilityCode",
      COALESCE(lrq.facility_name, lrq.facility_code) AS "facilityName",
      COUNT(DISTINCT lrq.lab_requests_id)::int  AS "requestCount",
      COUNT(lr.lab_results_id)::int             AS "resultCount",
      COUNT(DISTINCT lrq.patient_id)::int       AS "patientCount"
    FROM lab_requests lrq
    LEFT JOIN lab_results lr ON lr.lab_requests_id = lrq.lab_requests_id
    ${w}
    GROUP BY lrq.facility_code, lrq.facility_name
    ORDER BY "requestCount" DESC
    LIMIT 20
  `;

  const { rows } = await timedQuery(ext, sql, params);

  // Enrich with countryCode + lat/lng from openldr.facilities
  if (intClient && rows.length > 0) {
    try {
      const codes = (rows as any[]).map((r) => r.facilityCode);
      const placeholders = codes.map((_, i) => `$${i + 1}`).join(", ");
      const { rows: facilityRows } = await timedQuery(
        intClient,
        `SELECT "facilityCode", "countryCode", latitude, longitude
         FROM facilities
         WHERE "facilityCode" IN (${placeholders})`,
        codes,
      );

      const facilityMap = new Map(
        (facilityRows as any[]).map((f) => [f.facilityCode, f]),
      );

      return (rows as any[]).map((r) => {
        const fac = facilityMap.get(r.facilityCode);
        return {
          ...r,
          countryCode: fac?.countryCode ?? "",
          latitude: fac?.latitude ? Number(fac.latitude) : undefined,
          longitude: fac?.longitude ? Number(fac.longitude) : undefined,
        };
      });
    } catch (err) {
      logger.warn(err, "Could not enrich facility data from openldr");
    }
  }

  // Fallback: return without countryCode enrichment
  return (rows as any[]).map((r) => ({ ...r, countryCode: "" }));
}

// ============================================================
// Data Pipeline Counts (openldr_external)
// ============================================================

export async function getPipelineCounts(
  ext: PoolClient,
  filters: DashboardFilters,
): Promise<any[]> {
  const { conditions, params } = buildRequestFilters(filters);
  const w = toWhere(conditions);

  const { rows } = await timedQuery(
    ext,
    `SELECT COUNT(*)::int AS count FROM lab_requests ${w}`,
    params,
  );
  const processed = rows[0]?.count ?? 0;

  // Estimate upstream stages (replace with real opensearch/minio counts in production)
  const mapped = Math.round(processed * 1.02);
  const validated = Math.round(processed * 1.05);
  const raw = Math.round(processed * 1.1);

  return [
    { stage: "raw", label: "Raw", count: raw, color: "#64748b" },
    {
      stage: "validated",
      label: "Validated",
      count: validated,
      color: "#3b82f6",
    },
    { stage: "mapped", label: "Mapped", count: mapped, color: "#8b5cf6" },
    {
      stage: "processed",
      label: "Processed",
      count: processed,
      color: "#22c55e",
    },
  ];
}

// ============================================================
// Recent Lab Results (openldr_external)
//
// Columns used:
//   lab_results: lab_results_id, lab_requests_id, observation_code,
//     observation_desc, rpt_result, rpt_units, rpt_flag, result_timestamp
//   lab_requests: request_id, facility_code, facility_name, patient_id,
//     panel_code, panel_desc, specimen_datetime
// ============================================================

export async function getRecentLabResults(
  ext: PoolClient,
  filters: DashboardFilters,
  limit: number = 25,
): Promise<any[]> {
  const { conditions, params } = buildRequestFilters(filters, "lrq");
  const w = toWhere(conditions);
  const safeLimit = Math.min(Math.max(1, limit), 100);

  const sql = `
    SELECT
      lr.lab_results_id                                    AS "labResultsId",
      lrq.request_id                                       AS "requestId",
      COALESCE(lrq.facility_name, lrq.facility_code)       AS "facilityName",
      COALESCE(lrq.patient_id, '')                          AS "patientId",
      COALESCE(lrq.panel_desc, lrq.panel_code, '')          AS "panelDesc",
      COALESCE(lr.observation_desc, lr.observation_code, '') AS "observationDesc",
      COALESCE(lr.rpt_result, '')                            AS "rptResult",
      COALESCE(lr.rpt_units, '')                             AS "rptUnits",
      COALESCE(lr.rpt_flag, '')                              AS "rptFlag",
      COALESCE(lr.result_timestamp, lrq.specimen_datetime)   AS "resultTimestamp"
    FROM lab_results lr
    JOIN lab_requests lrq ON lr.lab_requests_id = lrq.lab_requests_id
    ${w}
    ORDER BY lr.result_timestamp DESC NULLS LAST
    LIMIT ${safeLimit}
  `;

  const { rows } = await timedQuery(ext, sql, params);
  return rows;
}

// ============================================================
// Service Health (network probes — no DB pool usage)
// ============================================================

export async function getServiceHealth(): Promise<ServiceHealthResult[]> {
  const isDev = process.env.NODE_ENV === "development";
  const results: ServiceHealthResult[] = [];

  // PostgreSQL — quick probe via internal pool
  const pgStart = Date.now();
  try {
    const res = await pool.query(
      "SELECT current_setting('server_version') AS ver",
    );
    results.push({
      name: "postgresql",
      displayName: "PostgreSQL",
      status: "healthy",
      responseTimeMs: Date.now() - pgStart,
      uptime: formatUptime(process.uptime()),
      version: res.rows[0]?.ver,
    });
  } catch {
    results.push({
      name: "postgresql",
      displayName: "PostgreSQL",
      status: "down",
      responseTimeMs: Date.now() - pgStart,
    });
  }

  // MinIO
  const minioUrl = isDev
    ? `http://localhost:${process.env.MINIO_API_PORT || 9000}/minio/health/live`
    : `http://${process.env.MINIO_HOSTNAME}:${process.env.MINIO_API_PORT || 9000}/minio/health/live`;
  const minioPing = await probeService(minioUrl);
  results.push({
    name: "minio",
    displayName: "MinIO",
    status: minioPing.ok ? "healthy" : "down",
    responseTimeMs: minioPing.responseTimeMs,
  });

  // Keycloak
  // Keycloak runs HTTPS-only (port 8443) with a self-signed cert in Docker.
  // Node fetch rejects self-signed certs, so we use a TCP probe to check
  // if the port is reachable. In dev, use the public URL via HTTP.
  if (
    process.env.KEYCLOAK_BASE_URL ||
    process.env.KEYCLOAK_PUBLIC_URL ||
    process.env.KEYCLOAK_HOSTNAME
  ) {
    let kcPing: { ok: boolean; responseTimeMs: number };

    if (isDev) {
      kcPing = await probeService(
        `${process.env.KEYCLOAK_PUBLIC_URL}/health/ready`,
      );
    } else {
      // TCP probe against the internal HTTPS port
      const kcHost = process.env.KEYCLOAK_HOSTNAME || "keycloak";
      const kcPort = parseInt(process.env.KEYCLOAK_INTERNAL_PORT || "8080", 10);
      kcPing = await tcpProbe(kcHost, kcPort);
    }

    results.push({
      name: "keycloak",
      displayName: "Keycloak",
      status: kcPing.ok
        ? "healthy"
        : kcPing.responseTimeMs > 3000
          ? "degraded"
          : "down",
      responseTimeMs: kcPing.responseTimeMs,
    });
  }

  // OpenSearch
  if (process.env.OPENSEARCH_URL || process.env.OPENSEARCH_HOSTNAME) {
    const osBase = isDev
      ? process.env.OPENSEARCH_URL || "http://localhost:9200"
      : `http://${process.env.OPENSEARCH_HOSTNAME}:9200`;
    const osPing = await probeService(osBase);
    results.push({
      name: "opensearch",
      displayName: "OpenSearch",
      status: osPing.ok ? "healthy" : "down",
      responseTimeMs: osPing.responseTimeMs,
    });
  }

  // Data Processing
  if (
    process.env.DATA_PROCESSING_HOSTNAME ||
    process.env.DATA_PROCESSING_PUBLIC_URL
  ) {
    const dpBase = isDev
      ? process.env.DATA_PROCESSING_PUBLIC_URL || "http://localhost:1003"
      : `http://${process.env.DATA_PROCESSING_HOSTNAME}:${process.env.DATA_PROCESSING_PORT || 1003}`;
    const dpPing = await probeService(`${dpBase}/health`);
    results.push({
      name: "data-processing",
      displayName: "Data Processing",
      status: dpPing.ok ? "healthy" : "down",
      responseTimeMs: dpPing.responseTimeMs,
    });
  }

  // Entity Services (self)
  results.push({
    name: "entity-services",
    displayName: "Entity Services",
    status: "healthy",
    responseTimeMs: 0,
    uptime: formatUptime(process.uptime()),
  });

  return results;
}

// ============================================================
// Storage Overview (MinIO — no DB)
// ============================================================

export async function getStorageOverview(intClient?: PoolClient): Promise<any> {
  try {
    const bucketNames = await minioService.listBuckets();

    // Resolve bucket names (projectIds) to projectNames from openldr.projects
    let nameMap = new Map<string, string>();
    if (intClient && bucketNames.length > 0) {
      try {
        const placeholders = bucketNames.map((_, i) => `$${i + 1}`).join(", ");
        const { rows } = await timedQuery(
          intClient,
          `SELECT "projectId"::text, "projectName"
           FROM projects
           WHERE "projectId"::text IN (${placeholders})`,
          bucketNames,
        );
        nameMap = new Map(
          (rows as any[]).map((r) => [r.projectId, r.projectName]),
        );
      } catch (err) {
        logger.warn(err, "Could not resolve bucket names to project names");
      }
    }

    const buckets: any[] = [];
    let totalObjects = 0;
    let usedSizeBytes = 0;

    // Batch bucket stats in groups of 3
    for (let i = 0; i < bucketNames.length; i += 3) {
      const batch = bucketNames.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            const stats = await minioService.getBucketStats(id);
            return {
              name: nameMap.get(id) || id,
              objectCount: stats.objectCount,
              sizeBytes: stats.totalSize,
              createdAt: "",
            };
          } catch {
            return {
              name: nameMap.get(id) || id,
              objectCount: 0,
              sizeBytes: 0,
              createdAt: "",
            };
          }
        }),
      );
      for (const b of batchResults) {
        buckets.push(b);
        totalObjects += b.objectCount;
        usedSizeBytes += b.sizeBytes;
      }
    }

    return {
      totalBuckets: bucketNames.length,
      totalObjects,
      totalSizeBytes: 0,
      usedSizeBytes,
      buckets,
    };
  } catch (error) {
    logger.error(error, "Failed to get storage overview");
    return {
      totalBuckets: 0,
      totalObjects: 0,
      totalSizeBytes: 0,
      usedSizeBytes: 0,
      buckets: [],
    };
  }
}

// ============================================================
// Database Stats (openldr via intClient, openldr_external via extClient)
//
// openldr tables (quoted camelCase): users, projects, "useCases",
//   facilities, plugins, "dataFeeds", "formSchemas", notifications,
//   extensions, "extensionVersions", "extensionPermissions",
//   "extensionReviews", "extensionUsers"
//
// openldr_external tables (snake_case): patients, lab_requests, lab_results
// ============================================================

export async function getDatabaseStats(
  intClient: PoolClient,
  extClient: PoolClient,
): Promise<any[]> {
  const databases: any[] = [];

  const dbMetaSql = `
    SELECT
      current_database()                       AS name,
      pg_database_size(current_database())      AS "sizeBytes",
      (SELECT count(*)::int
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE')         AS "tableCount",
      (SELECT count(*)::int
       FROM pg_stat_activity
       WHERE datname = current_database())      AS "activeConnections",
      current_setting('max_connections')::int   AS "maxConnections",
      EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::int AS "uptimeSeconds"
  `;

  const tableStatsSql = `
    SELECT
      s.relname              AS "tableName",
      n_live_tup::int      AS "rowCount",
      pg_total_relation_size(c.oid)::bigint AS "sizeBytes",
      pg_indexes_size(c.oid)::bigint        AS "indexSizeBytes"
    FROM pg_stat_user_tables s
    JOIN pg_class c ON c.relname = s.relname AND c.relkind = 'r'
    WHERE s.schemaname = 'public'
    ORDER BY n_live_tup DESC
  `;

  // Query both databases in parallel
  const [intMeta, intTables, extMeta, extTables] = await Promise.all([
    timedQuery(intClient, dbMetaSql),
    timedQuery(intClient, tableStatsSql),
    timedQuery(extClient, dbMetaSql),
    timedQuery(extClient, tableStatsSql),
  ]);

  // openldr
  if (intMeta.rows.length > 0) {
    const db = intMeta.rows[0] as any;
    databases.push({
      name: "Internal", //db.name,
      sizeBytes: Number(db.sizeBytes),
      tableCount: db.tableCount,
      activeConnections: db.activeConnections,
      maxConnections: db.maxConnections,
      uptime: formatUptime(db.uptimeSeconds),
      tables: (intTables.rows as any[])
        .map((t) => ({
          tableName: t.tableName,
          rowCount: t.rowCount,
          sizeBytes: Number(t.sizeBytes),
          indexSizeBytes: Number(t.indexSizeBytes),
        }))
        .sort((a, b) => b.sizeBytes - a.sizeBytes),
    });
  }

  // openldr_external
  if (extMeta.rows.length > 0) {
    const db = extMeta.rows[0] as any;
    databases.push({
      name: "External", //db.name,
      sizeBytes: Number(db.sizeBytes),
      tableCount: db.tableCount,
      activeConnections: db.activeConnections,
      maxConnections: db.maxConnections,
      uptime: formatUptime(db.uptimeSeconds),
      tables: (extTables.rows as any[])
        .map((t) => ({
          tableName: t.tableName,
          rowCount: t.rowCount,
          sizeBytes: Number(t.sizeBytes),
          indexSizeBytes: Number(t.indexSizeBytes),
        }))
        .sort((a, b) => b.sizeBytes - a.sizeBytes),
    });
  }

  return databases;
}

// ============================================================
// Aggregated Endpoints
//
// Rate-limit strategy:
// - ONE client per pool per request (not one per query)
// - DB queries sequential on same client (fast, indexed)
// - External probes (MinIO, Keycloak, etc.) in parallel
// - Clients always released in finally
// ============================================================

export async function getFullDashboard(
  filters: DashboardFilters,
): Promise<any> {
  const intClient = await pool.connect();
  const extClient = await externalPool.connect();

  try {
    // Phase 1: Lab data from openldr_external
    const kpi = await getKPI(extClient, filters);
    const labActivity = await getLabActivity(extClient, filters);
    const specimenDistribution = await getSpecimenDistribution(
      extClient,
      filters,
    );
    const testPanelVolume = await getTestPanelVolume(extClient, filters);
    const resultFlagDistribution = await getResultFlagDistribution(
      extClient,
      filters,
    );
    const facilityActivity = await getFacilityActivity(
      extClient,
      filters,
      intClient,
    );
    const pipeline = await getPipelineCounts(extClient, filters);
    // const recentResults = await getRecentLabResults(extClient, filters);

    // Phase 2: Infra (both pools + external services) in parallel
    const [databases, services, storage] = await Promise.all([
      getDatabaseStats(intClient, extClient),
      getServiceHealth(),
      getStorageOverview(intClient),
    ]);

    return {
      kpi,
      labActivity,
      specimenDistribution,
      testPanelVolume,
      resultFlagDistribution,
      facilityActivity,
      pipeline,
      services,
      storage,
      databases,
      // recentResults,
    };
  } finally {
    intClient.release();
    extClient.release();
  }
}

/**
 * Lab tab only — openldr_external + facility enrichment from openldr.
 */
export async function getLabDashboard(filters: DashboardFilters): Promise<any> {
  const intClient = await pool.connect();
  const extClient = await externalPool.connect();

  try {
    const kpi = await getKPI(extClient, filters);
    const labActivity = await getLabActivity(extClient, filters);
    const specimenDistribution = await getSpecimenDistribution(
      extClient,
      filters,
    );
    const testPanelVolume = await getTestPanelVolume(extClient, filters);
    const resultFlagDistribution = await getResultFlagDistribution(
      extClient,
      filters,
    );
    const facilityActivity = await getFacilityActivity(
      extClient,
      filters,
      intClient,
    );
    // const recentResults = await getRecentLabResults(extClient, filters);

    return {
      kpi,
      labActivity,
      specimenDistribution,
      testPanelVolume,
      resultFlagDistribution,
      facilityActivity,
      // recentResults,
    };
  } finally {
    intClient.release();
    extClient.release();
  }
}

/**
 * Infrastructure tab only — both pools + external services.
 */
export async function getInfraDashboard(
  filters: DashboardFilters,
): Promise<any> {
  const intClient = await pool.connect();
  const extClient = await externalPool.connect();

  try {
    const pipeline = await getPipelineCounts(extClient, filters);

    const [databases, services, storage] = await Promise.all([
      getDatabaseStats(intClient, extClient),
      getServiceHealth(),
      getStorageOverview(intClient),
    ]);

    return { pipeline, services, storage, databases };
  } finally {
    intClient.release();
    extClient.release();
  }
}
