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
import { queryOne } from "../lib/db";
import { requireAuth } from "../middleware/security";
import { runQuery } from "../lib/query-engine";

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
