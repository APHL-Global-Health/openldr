import express, { type Request, type Response } from "express";
import AdmZip from "adm-zip";
import {
  registryRateLimit,
  codeLoadRateLimit,
  requireApiKey,
  extensionPayloadHeaders,
  CONFIG,
  requireAuth,
  requireAdmin,
} from "../middleware/security";

import multer from "multer";
import { z } from "zod";
import { createHash } from "crypto";
import { putExtensionPayload, getExtensionPayload } from "../lib/storage";
import { query, queryOne } from "../lib/db";
import * as exts from "@openldr/extensions";
import type { ExtensionRow, UserExtensionInstall } from "@/types";

function rowToManifest(
  row: ExtensionRow,
  apiBase: string,
): exts.types.ExtensionManifest {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    description: row.description,
    kind: row.kind,
    slot: (row.slot as exts.types.ExtensionManifest["slot"]) ?? undefined,
    activationEvents: row.activation_events,
    contributes: row.contributes as exts.types.ExtensionManifest["contributes"],
    author: row.author,
    icon: row.icon,
    integrity: row.integrity,
    publishedAt: row.published_at,
    permissions: row.permissions as exts.types.ExtensionManifest["permissions"],
    codeUrl: `${apiBase}/api/v1/extensions/${row.id}/code`,
  };
}

// ── Manifest schema ───────────────────────────────────────────────────────

const ManifestSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9-]+$/,
      "id must be lowercase alphanumeric with hyphens only",
    ),
  name: z.string().min(1).max(128),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "version must be semver e.g. 1.2.3"),
  description: z.string().min(1).max(512),
  kind: z.enum(["worker", "iframe"]),
  slot: z.enum(["main", "secondary", "sidebar"]).optional(),
  author: z.string().min(1).max(128),
  icon: z.string().min(1).max(8),
  permissions: z.array(z.string()).default([]),
  activationEvents: z.array(z.string()).default([]),
  contributes: z
    .object({
      commands: z
        .array(z.object({ id: z.string(), title: z.string() }))
        .default([]),
      views: z
        .array(
          z.object({
            id: z.string(),
            slot: z.string(),
            title: z.string(),
          }),
        )
        .default([]),
    })
    .default({ commands: [], views: [] }),
});

// Memory storage — we handle the stream directly to MinIO
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max payload
});

// ── Bootstrap registry ────────────────────────────────────────────────────

// const registry = getRegistry(process.env.ENTITY_SERVICES_PUBLIC_URL!);

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /extensions/user ─────────────────────────────────────────────────
router.get(
  "/user",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const apiBase =
      process.env.VITE_API_BASE_URL || `${req.protocol}://${req.get("host")}`;

    const rows = await query<{
      extension_id: string;
      installed_at: string;
      approved_permissions: string[];
      settings: Record<string, unknown>;
      // joined from extensions table
      id: string;
      name: string;
      version: string;
      description: string;
      kind: "worker" | "iframe";
      slot: string | null;
      activation_events: string[];
      contributes: exts.types.ExtensionManifest["contributes"];
      author: string;
      icon: string;
      integrity: string;
      permissions: string[];
      published_at: string;
    }>(
      `SELECT
       ue.extension_id, ue.installed_at, ue.approved_permissions, ue.settings,
       e.id, e.name, e.version, e.description, e.kind, e.slot,
       e.activation_events, e.contributes, e.author, e.icon,
       e.integrity, e.permissions, e.published_at
     FROM "userExtensions" ue
     JOIN extensions e ON e.id = ue.extension_id
     WHERE ue.user_id = $1
     ORDER BY ue.installed_at ASC`,
      [userId],
    );

    const installs: UserExtensionInstall[] = rows.map((r) => ({
      extensionId: r.extension_id,
      installedAt: r.installed_at,
      approvedPermissions: r.approved_permissions,
      settings: r.settings,
      extension: buildManifest(r as ExtensionRow, apiBase),
    }));

    res.json({ installs, total: installs.length });
  },
);

/**
 * GET /
 * Returns the full registry: all extension manifests.
 * This is what the React app fetches on startup to discover available extensions.
 *
 * Rate-limited: 60 req/min (registry listing is heavier — triggers UI builds)
 */
router.get(
  "/",
  registryRateLimit,
  requireApiKey,
  async (req: Request, res: Response) => {
    const apiBase =
      process.env.VITE_API_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const rows = await query<ExtensionRow>(
      "SELECT * FROM extensions ORDER BY published_at DESC",
    );
    const extensions = rows.map((r) => rowToManifest(r, apiBase));
    res.json({ extensions, total: extensions.length, apiVersion: "2.0.0" });
  },
);

/**
 * GET /:id
 * Returns a single extension's manifest.
 */
router.get(
  "/:id",
  registryRateLimit,
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    const apiBase =
      process.env.VITE_API_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const row = await queryOne<ExtensionRow>(
      "SELECT * FROM extensions WHERE id = $1",
      [req.params.id],
    );
    if (!row) {
      res.status(404).json({
        error: `Extension '${req.params.id}' not found`,
        code: "NOT_FOUND",
        status: 404,
      });
      return;
    }
    res.json(rowToManifest(row, apiBase));
  },
);

/**
 * GET /:id/code
 * Returns the extension's payload (raw JS or HTML string) with integrity hash.
 *
 * Security:
 *  • Rate-limited: 30 req/min (prevent bulk scraping)
 *  • Integrity hash included in both response body AND X-Integrity header
 *  • Client MUST verify hash before loading into Worker/iframe
 *  • Response is JSON — the client controls how the payload is used
 *
 * The payload is delivered as a JSON-wrapped string, NOT as raw JS/HTML.
 * This means the browser never directly executes what this endpoint returns.
 * The React app injects it into a Worker blob or iframe srcdoc — giving the
 * HOST full control over the execution context.
 */
router.get(
  "/:id/code",
  codeLoadRateLimit,
  requireApiKey,
  extensionPayloadHeaders,
  async (req: Request, res: Response): Promise<void> => {
    const row = await queryOne<ExtensionRow>(
      "SELECT * FROM extensions WHERE id = $1",
      [req.params.id],
    );
    if (!row || !row.storage_key) {
      res.status(404).json({
        error: `Extension '${req.params.id}' not found`,
        code: "NOT_FOUND",
        status: 404,
      });
      return;
    }

    let payload: string;
    try {
      payload = await getExtensionPayload(row.storage_key);
    } catch (err) {
      console.error(
        `[Extensions] Failed to fetch payload from MinIO for ${row.id}:`,
        err,
      );
      res.status(502).json({
        error: "Payload unavailable",
        code: "STORAGE_ERROR",
        status: 502,
      });
      return;
    }

    res.setHeader("X-Integrity", row.integrity);
    res.json({
      id: row.id,
      kind: row.kind,
      payload,
      integrity: row.integrity,
      cacheUntil: Date.now() + CONFIG.payloadCacheSeconds * 1000,
    });
  },
);

/**
 * GET /:id/permissions
 * Lightweight endpoint — returns just the permissions list.
 * Useful for the host to display a "this extension requires..." prompt
 * before loading.
 */
router.get(
  "/:id/permissions",
  registryRateLimit,
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    const row = await queryOne<{
      id: string;
      name: string;
      permissions: string[];
    }>("SELECT id, name, permissions FROM extensions WHERE id = $1", [
      req.params.id,
    ]);
    if (!row) {
      res.status(404).json({
        error: `Extension '${req.params.id}' not found`,
        code: "NOT_FOUND",
        status: 404,
      });
      return;
    }
    res.json({ id: row.id, name: row.name, permissions: row.permissions });
  },
);

router.post(
  "/",
  requireAuth,
  requireAdmin,
  upload.single("bundle"),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({
        error: "bundle field (ZIP file) required",
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    // ── Extract ZIP ───────────────────────────────────────────────────────
    let zip: AdmZip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch {
      res
        .status(400)
        .json({ error: "Invalid ZIP file", code: "INVALID_ZIP", status: 400 });
      return;
    }

    const entries = Object.fromEntries(
      zip.getEntries().map((e) => [e.entryName, e]),
    );

    // ── Read + validate manifest.json ─────────────────────────────────────
    if (!entries["manifest.json"]) {
      res.status(400).json({
        error: "manifest.json missing from ZIP",
        code: "INVALID_ZIP",
        status: 400,
      });
      return;
    }

    let rawManifest: unknown;
    try {
      rawManifest = JSON.parse(
        entries["manifest.json"].getData().toString("utf8"),
      );
    } catch {
      res.status(400).json({
        error: "manifest.json is not valid JSON",
        code: "INVALID_ZIP",
        status: 400,
      });
      return;
    }

    const parsed = ManifestSchema.safeParse(rawManifest);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid manifest.json",
        details: parsed.error.flatten(),
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    const manifest = parsed.data;

    // ── Read payload ──────────────────────────────────────────────────────
    const payloadEntry =
      manifest.kind === "worker" ? entries["index.js"] : entries["index.html"];

    const payloadFilename =
      manifest.kind === "worker" ? "index.js" : "index.html";

    if (!payloadEntry) {
      res.status(400).json({
        error: `${payloadFilename} missing from ZIP (required for kind: ${manifest.kind})`,
        code: "INVALID_ZIP",
        status: 400,
      });
      return;
    }

    const payloadStr = payloadEntry.getData().toString("utf8");
    const contentType =
      manifest.kind === "iframe" ? "text/html" : "application/javascript";

    // ── Integrity ─────────────────────────────────────────────────────────
    const hash = createHash("sha256")
      .update(payloadStr, "utf8")
      .digest("base64");
    const integrity = `sha256-${hash}`;

    // ── Upload payload to MinIO ───────────────────────────────────────────
    let storageKey: string;
    try {
      storageKey = await putExtensionPayload(
        manifest.id,
        manifest.version,
        payloadStr,
        contentType,
      );
    } catch (err) {
      console.error("[Publish] MinIO upload failed:", err);
      res.status(502).json({
        error: "Failed to store payload",
        code: "STORAGE_ERROR",
        status: 502,
      });
      return;
    }

    // ── Upsert into PostgreSQL ────────────────────────────────────────────
    await query(
      `INSERT INTO extensions
         (id, name, version, description, kind, slot, activation_events,
          contributes, author, icon, integrity, permissions, storage_key, published_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         name              = EXCLUDED.name,
         version           = EXCLUDED.version,
         description       = EXCLUDED.description,
         kind              = EXCLUDED.kind,
         slot              = EXCLUDED.slot,
         activation_events = EXCLUDED.activation_events,
         contributes       = EXCLUDED.contributes,
         author            = EXCLUDED.author,
         icon              = EXCLUDED.icon,
         integrity         = EXCLUDED.integrity,
         permissions       = EXCLUDED.permissions,
         storage_key       = EXCLUDED.storage_key,
         updated_at        = NOW()`,
      [
        manifest.id,
        manifest.name,
        manifest.version,
        manifest.description,
        manifest.kind,
        manifest.slot ?? null,
        JSON.stringify(manifest.activationEvents),
        JSON.stringify(manifest.contributes),
        manifest.author,
        manifest.icon,
        integrity,
        JSON.stringify(manifest.permissions),
        storageKey,
      ],
    );

    // console.log(
    //   `[Publish] ✓ ${(req as any).user!.username} published ${manifest.id}@${manifest.version}`,
    // );

    res.status(201).json({
      id: manifest.id,
      version: manifest.version,
      kind: manifest.kind,
      integrity,
      storageKey,
      publishedAt: new Date().toISOString(),
    });
  },
);

function buildManifest(
  row: ExtensionRow,
  apiBase: string,
): exts.types.ExtensionManifest {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    description: row.description,
    kind: row.kind,
    slot: (row.slot ?? undefined) as exts.types.ExtensionManifest["slot"],
    activationEvents: row.activation_events,
    contributes: row.contributes,
    author: row.author,
    icon: row.icon,
    integrity: row.integrity,
    publishedAt: row.published_at,
    permissions: row.permissions as exts.types.ExtensionManifest["permissions"],
    codeUrl: `${apiBase}/api/v1/extensions/${row.id}/code`,
  };
}

// ── POST /extensions/user/:id ────────────────────────────────────────────

const InstallBody = z.object({
  approvedPermissions: z.array(z.string()).default([]),
  settings: z.record(z.string(), z.unknown()).default({}),
});

router.post(
  "/user/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.params.id;

    // Validate body
    const parsed = InstallBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten(),
        code: "VALIDATION_ERROR",
        status: 400,
      });
      return;
    }

    // Verify extension exists
    const ext = await queryOne<{ id: string }>(
      "SELECT id FROM extensions WHERE id = $1",
      [extensionId],
    );

    if (!ext) {
      res.status(404).json({
        error: `Extension '${extensionId}' not found`,
        code: "NOT_FOUND",
        status: 404,
      });
      return;
    }

    const { approvedPermissions, settings } = parsed.data;

    await query(
      `INSERT INTO "userExtensions" (user_id, extension_id, approved_permissions, settings, installed_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, extension_id)
     DO UPDATE SET
       approved_permissions = EXCLUDED.approved_permissions,
       settings             = EXCLUDED.settings`,
      [
        userId,
        extensionId,
        JSON.stringify(approvedPermissions),
        JSON.stringify(settings),
      ],
    );

    console.log(`[UserExtensions] ${userId} installed ${extensionId}`);
    res.status(201).json({
      extensionId,
      approvedPermissions,
      settings,
      installedAt: new Date().toISOString(),
    });
  },
);

// ── DELETE /extensions/user/:id ──────────────────────────────────────────

router.delete(
  "/user/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.params.id;

    const result = await query<{ extension_id: string }>(
      `DELETE FROM "userExtensions" WHERE user_id = $1 AND extension_id = $2 RETURNING extension_id`,
      [userId, extensionId],
    );

    if (result.length === 0) {
      res.status(404).json({
        error: "Install record not found",
        code: "NOT_FOUND",
        status: 404,
      });
      return;
    }

    console.log(`[UserExtensions] ${userId} uninstalled ${extensionId}`);
    res.json({ extensionId, uninstalledAt: new Date().toISOString() });
  },
);

// ── PATCH /extensions/user/:id ───────────────────────────────────────────

const PatchBody = z.object({
  settings: z.record(z.string(), z.unknown()),
});

router.patch(
  "/user/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user!.id;
    const extensionId = req.params.id;

    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid body", code: "VALIDATION_ERROR", status: 400 });
      return;
    }

    const result = await query<{ extension_id: string }>(
      `UPDATE "userExtensions" SET settings = $3
     WHERE user_id = $1 AND extension_id = $2
     RETURNING extension_id`,
      [userId, extensionId, JSON.stringify(parsed.data.settings)],
    );

    if (result.length === 0) {
      res.status(404).json({
        error: "Install record not found",
        code: "NOT_FOUND",
        status: 404,
      });
      return;
    }

    res.json({ extensionId, settings: parsed.data.settings });
  },
);

export default router;
