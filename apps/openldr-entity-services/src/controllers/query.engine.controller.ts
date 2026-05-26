// ─────────────────────────────────────────────────────────────────────────────
// routes/data.ts
//
// POST /api/v1/query/engine
//
// QUERY_MODE env var controls behaviour:
//   direct (default) — queries openldr_external PostgreSQL directly
//   proxy            — forwards to OPENLDR_API_URL (live OpenLDR instance)
//
// Either way, JWT auth + per-user permission checks run first.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { queryOne, query, externalPool, pool } from "../lib/db";
import { requireAuth } from "../middleware/security";
import { runQuery } from "../lib/query-engine";
import { getExtensionScript } from "../lib/storage";
import { encryptCredentials, decryptCredentials } from "../lib/credentials";
import type { ScriptsMap } from "@/types";
import rateLimit from "express-rate-limit";

export const router = Router();

const QUERY_MODE = process.env.QUERY_MODE || "direct";
const OPENLDR_API_URL = process.env.OPENLDR_API_URL || "http://localhost:3000";

// ── Permission map ────────────────────────────────────────────────────────

const PERMISSION_MAP: Record<string, Record<string, string>> = {
  external: {
    patients: "data.patients",
    lab_requests: "data.labRequests",
    lab_results: "data.labResults",
  },
};
const BROAD_QUERY_PERMISSION = "data.query";

// ── Request schema ────────────────────────────────────────────────────────

const ScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const OperatorSchema = z
  .object({
    eq: ScalarSchema.optional(),
    ne: ScalarSchema.optional(),
    gt: ScalarSchema.optional(),
    gte: ScalarSchema.optional(),
    lt: ScalarSchema.optional(),
    lte: ScalarSchema.optional(),
    like: z.string().optional(),
    in: z.array(ScalarSchema).optional(),
  })
  .strict();

const FilterValueSchema = z.union([ScalarSchema, OperatorSchema]);

const QueryBodySchema = z.object({
  schema: z.enum(["internal", "external"]),
  table: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z_]+$/),
  params: z
    .object({
      filters: z.record(z.string(), FilterValueSchema).optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(500).default(100),
      sort: z
        .object({
          field: z.string(),
          direction: z.enum(["asc", "desc"]),
        })
        .optional(),
    })
    .optional()
    .default(() => ({ page: 1, limit: 100 })),
});

// ── Auth + permission check (shared) ─────────────────────────────────────

async function checkPermission(
  userId: string,
  extensionId: string,
  schema: string,
  table: string,
  res: Response,
): Promise<boolean> {
  const install = await queryOne<{ approved_permissions: string[] }>(
    `SELECT approved_permissions FROM "userExtensions" WHERE user_id = $1 AND extension_id = $2`,
    [userId, extensionId],
  );

  if (!install) {
    res.status(403).json({
      error: "Extension not installed by this user",
      code: "NOT_INSTALLED",
      status: 403,
    });
    return false;
  }

  const approved = install.approved_permissions;
  const specificPerm = PERMISSION_MAP[schema]?.[table];
  const hasBroad = approved.includes(BROAD_QUERY_PERMISSION);
  const hasSpecific = specificPerm ? approved.includes(specificPerm) : false;

  if (!hasBroad && !hasSpecific) {
    res.status(403).json({
      error: `Permission denied: requires '${specificPerm || BROAD_QUERY_PERMISSION}' for ${schema}.${table}`,
      code: "PERMISSION_DENIED",
      required: specificPerm || BROAD_QUERY_PERMISSION,
      approved,
      status: 403,
    });
    return false;
  }

  return true;
}

// ── POST api/v1/query/engine ──────────────────────────────────────────────────────

router.post(
  "/",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.headers["x-extension-id"] as string | undefined;

    if (!extensionId) {
      res.status(400).json({
        error: "X-Extension-Id header required",
        code: "MISSING_EXTENSION_ID",
        status: 400,
      });
      return;
    }

    const parsed = QueryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten(),
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    const { schema, table, params } = parsed.data;

    const allowed = await checkPermission(
      userId,
      extensionId,
      schema,
      table,
      res,
    );
    if (!allowed) return;

    // ── Direct mode — query openldr_external directly ─────────────────────
    if (QUERY_MODE === "direct") {
      try {
        const result = await runQuery(schema, table, params);
        console.log(
          `[Data:direct] ${userId}/${extensionId} → ${schema}.${table} page=${params.page} limit=${params.limit} total=${result.total}`,
        );
        res.json(result);
      } catch (err) {
        const msg = (err as Error).message;
        console.error(
          `[Data:direct] Query failed for ${schema}.${table}:`,
          msg,
        );
        // Unknown table → 400, everything else → 500
        const status = msg.startsWith("Unknown table") ? 400 : 500;
        res.status(status).json({ error: msg, code: "QUERY_ERROR", status });
      }
      return;
    }

    // ── Proxy mode — forward to live OpenLDR API ──────────────────────────
    const targetUrl = `${OPENLDR_API_URL}/api/v1/archieves/${schema}/${table}/data`;
    let response: globalThis.Response;
    try {
      response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.authorization || "",
        },
        body: JSON.stringify(params),
      });
    } catch (err) {
      console.error(
        `[Data:proxy] Failed to reach OpenLDR API at ${targetUrl}:`,
        err,
      );
      res.status(502).json({
        error: "OpenLDR API unreachable",
        code: "UPSTREAM_ERROR",
        status: 502,
      });
      return;
    }

    const body = await response
      .json()
      .catch(() => ({ error: "Invalid JSON from upstream" }));
    if (!response.ok) {
      console.warn(
        `[Data:proxy] OpenLDR returned ${response.status} for ${schema}.${table}`,
      );
      res.status(response.status).json(body);
      return;
    }

    console.log(
      `[Data:proxy] ${userId}/${extensionId} → ${schema}.${table} ${response.status}`,
    );
    res.json(body);
  },
);

// ── Exec rate limiter ────────────────────────────────────────────────────────

const execRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  message: {
    error: "Too many exec requests — try again later",
    code: "RATE_LIMITED",
    status: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Exec schema ─────────────────────────────────────────────────────────────

const ExecBodySchema = z.object({
  script: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9_]+$/),
  params: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
});

// ── POST /api/v1/query/engine/exec ──────────────────────────────────────────

router.post(
  "/exec",
  execRateLimit,
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const isAdmin = !!(req as any).user?.isAdmin;
    const extensionId = req.headers["x-extension-id"] as string | undefined;

    if (!extensionId) {
      res.status(400).json({
        error: "X-Extension-Id header required",
        code: "MISSING_EXTENSION_ID",
        status: 400,
      });
      return;
    }

    const parsed = ExecBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten(),
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    const { script: scriptId, params } = parsed.data;

    // Check user has extension installed with data.exec permission
    const install = await queryOne<{ approved_permissions: string[] }>(
      `SELECT approved_permissions FROM "userExtensions" WHERE user_id = $1 AND extension_id = $2`,
      [userId, extensionId],
    );

    if (!install) {
      res.status(403).json({
        error: "Extension not installed by this user",
        code: "NOT_INSTALLED",
        status: 403,
      });
      return;
    }

    if (!install.approved_permissions.includes("data.exec")) {
      res.status(403).json({
        error: "Permission denied: requires 'data.exec'",
        code: "PERMISSION_DENIED",
        status: 403,
      });
      return;
    }

    // Look up extension and its scripts metadata
    const ext = await queryOne<{
      id: string;
      version: string;
      scripts: ScriptsMap;
    }>("SELECT id, version, scripts FROM extensions WHERE id = $1", [
      extensionId,
    ]);

    if (!ext) {
      res.status(404).json({
        error: `Extension '${extensionId}' not found`,
        code: "NOT_FOUND",
        status: 404,
      });
      return;
    }

    const scriptDef = ext.scripts[scriptId];
    if (!scriptDef) {
      res.status(404).json({
        error: `Script '${scriptId}' not found in extension '${extensionId}'`,
        code: "SCRIPT_NOT_FOUND",
        availableScripts: Object.keys(ext.scripts),
        status: 404,
      });
      return;
    }

    // Admin check for restricted scripts
    if (scriptDef.requiresAdmin && !isAdmin) {
      res.status(403).json({
        error: `Script '${scriptId}' requires admin role`,
        code: "ADMIN_REQUIRED",
        status: 403,
      });
      return;
    }

    // Validate params against declared param whitelist
    if (params) {
      const allowedParams = scriptDef.params || [];
      const extraKeys = Object.keys(params).filter(
        (k) => !allowedParams.includes(k),
      );
      if (extraKeys.length > 0) {
        res.status(400).json({
          error: `Undeclared parameters: ${extraKeys.join(", ")}. Allowed: ${allowedParams.join(", ") || "none"}`,
          code: "INVALID_PARAMS",
          status: 400,
        });
        return;
      }
    }

    // Load SQL from MinIO
    let sql: string;
    try {
      sql = await getExtensionScript(ext.id, ext.version, scriptId);
    } catch (err) {
      console.error(
        `[Exec] Failed to load script ${scriptId} from MinIO:`,
        err,
      );
      res.status(502).json({
        error: "Failed to load script from storage",
        code: "STORAGE_ERROR",
        status: 502,
      });
      return;
    }

    // Substitute declared params ({{paramName}} placeholders)
    if (params && scriptDef.params?.length) {
      for (const paramName of scriptDef.params) {
        const value = params[paramName];
        if (value !== undefined && value !== null) {
          const strVal = String(value);
          // Sanitize: prevent SQL injection in template params
          if (/['";\\]|--|\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i.test(strVal)) {
            res.status(400).json({
              error: `Parameter '${paramName}' contains disallowed characters`,
              code: "INVALID_PARAM_VALUE",
              status: 400,
            });
            return;
          }
          const placeholder = `{{${paramName}}}`;
          sql = sql.split(placeholder).join(strVal);
        }
      }
    }

    // Execute against the appropriate pool
    const targetPool =
      scriptDef.database === "external" ? externalPool : pool;
    const startMs = Date.now();

    try {
      const result = await targetPool.query(sql);
      const durationMs = Date.now() - startMs;

      // result may be an array of query results if the script has multiple statements
      const rows = Array.isArray(result)
        ? result[result.length - 1]?.rows ?? []
        : result.rows ?? [];
      const rowCount = Array.isArray(result)
        ? result[result.length - 1]?.rowCount ?? 0
        : result.rowCount ?? 0;

      console.log(
        `[Exec] ${userId}/${extensionId}/${scriptId} → ${scriptDef.database} ${durationMs}ms rows=${rowCount}`,
      );

      res.json({ ok: true, rows, rowCount, durationMs });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const msg = (err as Error).message;
      console.error(
        `[Exec] ${userId}/${extensionId}/${scriptId} FAILED (${durationMs}ms):`,
        msg,
      );
      res
        .status(500)
        .json({ error: msg, code: "EXEC_ERROR", status: 500 });
    }
  },
);

// ── Credentials routes ──────────────────────────────────────────────────────

const CredentialSaveSchema = z.object({
  type: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
  data: z.record(z.string(), z.string()),
});

const CredentialTypeSchema = z.object({
  type: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
});

router.post(
  "/credentials/save",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.headers["x-extension-id"] as string | undefined;

    if (!extensionId) {
      res.status(400).json({
        error: "X-Extension-Id header required",
        code: "MISSING_EXTENSION_ID",
        status: 400,
      });
      return;
    }

    const parsed = CredentialSaveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten(),
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    const { type, data } = parsed.data;

    try {
      const encrypted = encryptCredentials(data);

      await query(
        `INSERT INTO extension_credentials (extension_id, user_id, credential_type, encrypted_data, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (extension_id, user_id, credential_type)
         DO UPDATE SET encrypted_data = EXCLUDED.encrypted_data, updated_at = NOW()`,
        [extensionId, userId, type, encrypted],
      );

      console.log(
        `[Credentials] ${userId}/${extensionId} saved type=${type}`,
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("[Credentials] Save failed:", err);
      res.status(500).json({
        error: "Failed to save credentials",
        code: "CREDENTIAL_ERROR",
        status: 500,
      });
    }
  },
);

router.post(
  "/credentials/check",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.headers["x-extension-id"] as string | undefined;

    if (!extensionId) {
      res.status(400).json({
        error: "X-Extension-Id header required",
        code: "MISSING_EXTENSION_ID",
        status: 400,
      });
      return;
    }

    const parsed = CredentialTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    const row = await queryOne<{ created_at: string; updated_at: string }>(
      `SELECT created_at, updated_at FROM extension_credentials
       WHERE extension_id = $1 AND user_id = $2 AND credential_type = $3`,
      [extensionId, userId, parsed.data.type],
    );

    res.json({
      exists: !!row,
      createdAt: row?.created_at ?? null,
      updatedAt: row?.updated_at ?? null,
    });
  },
);

router.post(
  "/credentials/load",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.headers["x-extension-id"] as string | undefined;

    if (!extensionId) {
      res.status(400).json({
        error: "X-Extension-Id header required",
        code: "MISSING_EXTENSION_ID",
        status: 400,
      });
      return;
    }

    const parsed = CredentialTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    const row = await queryOne<{ encrypted_data: string }>(
      `SELECT encrypted_data FROM extension_credentials
       WHERE extension_id = $1 AND user_id = $2 AND credential_type = $3`,
      [extensionId, userId, parsed.data.type],
    );

    if (!row) {
      res.json({ exists: false, data: null });
      return;
    }

    try {
      const data = decryptCredentials(row.encrypted_data);
      res.json({ exists: true, data });
    } catch (err) {
      console.error("[Credentials] Decrypt failed:", err);
      res.status(500).json({
        error: "Failed to decrypt credentials",
        code: "CREDENTIAL_ERROR",
        status: 500,
      });
    }
  },
);

router.post(
  "/credentials/delete",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.headers["x-extension-id"] as string | undefined;

    if (!extensionId) {
      res.status(400).json({
        error: "X-Extension-Id header required",
        code: "MISSING_EXTENSION_ID",
        status: 400,
      });
      return;
    }

    const parsed = CredentialTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    await query(
      `DELETE FROM extension_credentials
       WHERE extension_id = $1 AND user_id = $2 AND credential_type = $3`,
      [extensionId, userId, parsed.data.type],
    );

    res.json({ ok: true });
  },
);

// ── Storage routes ────────────────────────────────────────────────────────────────

router.post(
  "/storage/get",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.headers["x-extension-id"] as string | undefined;
    const { key } = req.body as { key: string };

    if (!extensionId || !key) {
      res.status(400).json({
        error: "X-Extension-Id header and key required",
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    const install = await queryOne<{ settings: Record<string, unknown> }>(
      `SELECT settings FROM "userExtensions" WHERE user_id = $1 AND extension_id = $2`,
      [userId, extensionId],
    );

    res.json({ value: install?.settings?.[key] ?? null });
  },
);

router.post(
  "/storage/set",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.headers["x-extension-id"] as string | undefined;
    const { key, value } = req.body as { key: string; value: unknown };

    if (!extensionId || !key) {
      res.status(400).json({
        error: "X-Extension-Id header and key required",
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    await queryOne(
      `UPDATE "userExtensions"
     SET settings = settings || jsonb_build_object($3::text, $4::jsonb)
     WHERE user_id = $1 AND extension_id = $2`,
      [userId, extensionId, key, JSON.stringify(value)],
    );

    res.json({ ok: true });
  },
);

router.post(
  "/storage/delete",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.headers["x-extension-id"] as string | undefined;
    const { key } = req.body as { key: string };

    if (!extensionId || !key) {
      res.status(400).json({
        error: "X-Extension-Id header and key required",
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    await queryOne(
      `UPDATE "userExtensions" SET settings = settings - $3 WHERE user_id = $1 AND extension_id = $2`,
      [userId, extensionId, key],
    );

    res.json({ ok: true });
  },
);

export default router;
