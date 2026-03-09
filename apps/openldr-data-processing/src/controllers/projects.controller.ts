// ─────────────────────────────────────────────────────────────────────────────
// Mount in your main Express app:
//   import pluginTestRouter from './routes/plugin-test.route';
//   app.use('/api/plugin-tests', pluginTestRouter);
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import { Router, type Request, type Response } from "express";
import { db } from "@/lib/db.plugin.test";
import { runPluginTest } from "@/services/plugin.runner.service";
import type {
  RunPluginTestRequest,
  SavePluginAssignmentRequest,
  // CreateProjectRequest,
  // CreateUseCaseRequest,
  // CreateDataFeedRequest,
  // CreatePluginRequest,
  PluginSlotType,
} from "@/types/plugin.test.types";

const router = Router();

// ── Utility ───────────────────────────────────────────────────────────────────
const ok = (res: Response, data: unknown) =>
  res.json({ ok: true, ...(typeof data === "object" ? data : { data }) });
const err = (res: Response, msg: string, status = 400) =>
  res.status(status).json({ ok: false, error: msg });

// ─────────────────────────────────────────────────────────────────────────────
// Context lookups
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/plugin-tests/projects */
router.get("", async (_req, res) => {
  ok(res, { projects: await db.getProjects() });
});

/** POST /api/plugin-tests/projects */
// router.post("", async (req: Request<{}, {}, CreateProjectRequest>, res) => {
//   const { name } = req.body;
//   if (!name?.trim()) return err(res, "name is required");
//   ok(res, { project: await db.createProject(name.trim()) });
// });

/** GET /api/plugin-tests/projects/:projectId/use-cases */
router.get("/:projectId/use-cases", async (req, res) => {
  const { projectId } = req.params;
  if (!(await db.getProject(projectId)))
    return err(res, "Project not found", 404);
  ok(res, { useCases: await db.getUseCases(projectId) });
});

/** POST /api/plugin-tests/use-cases */
// router.post(
//   "/use-cases",
//   async (req: Request<{}, {}, CreateUseCaseRequest>, res) => {
//     const { name, projectId } = req.body;
//     if (!name?.trim()) return err(res, "name is required");
//     if (!projectId) return err(res, "projectId is required");
//     if (!(await db.getProject(projectId)))
//       return err(res, "Project not found", 404);
//     ok(res, { useCase: await db.createUseCase(name.trim(), projectId) });
//   },
// );

/** GET /api/plugin-tests/use-cases/:useCaseId/feeds */
router.get("/use-cases/:useCaseId/feeds", async (req, res) => {
  ok(res, { feeds: await db.getDataFeeds(req.params.useCaseId) });
});

/** POST /api/plugin-tests/feeds */
// router.post(
//   "/feeds",
//   async (req: Request<{}, {}, CreateDataFeedRequest>, res) => {
//     const { name, useCaseId } = req.body;
//     if (!name?.trim()) return err(res, "name is required");
//     if (!useCaseId) return err(res, "useCaseId is required");
//     ok(res, { feed: await db.createDataFeed(name.trim(), useCaseId) });
//   },
// );

// ─────────────────────────────────────────────────────────────────────────────
// Plugins
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SLOTS: PluginSlotType[] = ["validation", "mapping", "outpost"];

/** GET /api/plugin-tests/plugins?slot=validation */
router.get("/plugins", async (req, res) => {
  const slot = req.query.slot as PluginSlotType | undefined;
  if (slot && !VALID_SLOTS.includes(slot)) return err(res, "Invalid slot");
  ok(res, {
    plugins: slot
      ? await db.getPlugins(slot)
      : await Promise.all(VALID_SLOTS.map((s) => db.getPlugins(s))),
  });
});

/** POST /api/plugin-tests/plugins */
// router.post(
//   "/plugins",
//   async (req: Request<{}, {}, CreatePluginRequest>, res) => {
//     const { name, slot, code } = req.body;
//     if (!name?.trim()) return err(res, "name is required");
//     if (!VALID_SLOTS.includes(slot))
//       return err(res, "slot must be validation | mapping | outpost");
//     ok(res, { plugin: await db.createPlugin(name.trim(), slot, code) });
//   },
// );

// ─────────────────────────────────────────────────────────────────────────────
// Test runner  (the core endpoint)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/plugin-tests/run
 *
 * Body: RunPluginTestRequest
 * Runs selected plugins in VM (no Kafka).
 * Returns per-stage results + allPassed flag.
 */
router.post("/run", async (req: Request<{}, {}, RunPluginTestRequest>, res) => {
  const { payload, validationPluginId, mappingPluginId, outpostPluginId } = req.body;

  if (!payload?.trim()) return err(res, "payload is required");
  if (!validationPluginId && !mappingPluginId && !outpostPluginId)
    return err(
      res,
      "At least one of validationPluginId, mappingPluginId, or outpostPluginId is required",
    );

  // Resolve plugin code from store
  let validation: { id: string; code: string; type: string } | null = null;
  let mapping: { id: string; code: string; type: string } | null = null;
  let outpost: { id: string; code: string; type: string } | null = null;

  if (validationPluginId) {
    const p = await db.getPluginById(validationPluginId);
    if (!p)
      return err(
        res,
        `Validation plugin "${validationPluginId}" not found`,
        404,
      );
    const code = fs.readFileSync(p.code, "utf8");
    validation = { id: p.id, code, type: p.slot };
  }

  if (mappingPluginId) {
    const p = await db.getPluginById(mappingPluginId);
    if (!p)
      return err(res, `Mapping plugin "${mappingPluginId}" not found`, 404);

    const code = fs.readFileSync(p.code, "utf8");
    mapping = { id: p.id, code, type: p.slot };
  }

  if (outpostPluginId) {
    const p = await db.getPluginById(outpostPluginId);
    if (!p)
      return err(res, `Outpost plugin "${outpostPluginId}" not found`, 404);

    const code = fs.readFileSync(p.code, "utf8");
    outpost = { id: p.id, code, type: p.slot };
  }

  try {
    const result = await runPluginTest({ payload, validation, mapping, outpost });
    res.json(result);
  } catch (e) {
    console.error("[plugin-test] run error:", e);
    err(res, (e as Error).message, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Save assignment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/plugin-tests/assignments
 *
 * Persists plugin assignment to a data feed after successful test.
 */
router.post(
  "/assignments",
  (req: Request<{}, {}, SavePluginAssignmentRequest>, res) => {
    const { feedId, validationPluginId, mappingPluginId, outpostPluginId } =
      req.body;
    if (!feedId) return err(res, "feedId is required");

    const assignment = db.upsertAssignment({
      feedId,
      validationPluginId: validationPluginId ?? null,
      mappingPluginId: mappingPluginId ?? null,
      outpostPluginId: outpostPluginId ?? null,
    });

    ok(res, { assignment });
  },
);

/** GET /api/plugin-tests/assignments/:feedId */
router.get("/assignments/:feedId", (req, res) => {
  const assignment = db.getAssignment(req.params.feedId);
  if (!assignment) return err(res, "No assignment found for this feed", 404);
  ok(res, { assignment });
});

export default router;
