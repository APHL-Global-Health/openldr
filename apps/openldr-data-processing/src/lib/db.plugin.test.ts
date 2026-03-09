// ─────────────────────────────────────────────────────────────────────────────
//
// Lightweight in-memory store used during development so the test harness works
// without a running PostgreSQL instance.
// Replace each exported function with your actual Sequelize model calls.
// ─────────────────────────────────────────────────────────────────────────────

// import { v4 as uuid } from "uuid";
import type {
  Project,
  UseCase,
  DataFeed,
  Plugin,
  DataFeedPluginAssignment,
  PluginSlotType,
} from "@/types/plugin.test.types";

import { pool } from "../lib/db";
import { logger } from "../lib/logger";
import { BUNDLED_DEFAULT_PLUGINS } from "./constants";

const assignments: DataFeedPluginAssignment[] = [];

// ── Query helpers (swap these out for Sequelize model calls) ──────────────────

export const db = {
  // Projects
  getProjects: async (): Promise<Project[]> => {
    try {
      const sql = `
        SELECT *
        FROM "projects"
    `;
      const res = await pool.query(sql);
      return res.rows;
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
  },
  getProject: async (id: string): Promise<Project | null> => {
    try {
      const sql = `
        SELECT *
        FROM "projects"
        WHERE "projectId" = $1;
    `;
      const res = await pool.query(sql, [id]);
      if (res.rowCount == 1) {
        return res.rows[0];
      }

      return null;
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
  },
  // createProject(name: string): Project {
  //   const p: Project = {
  //     id: uuid(),
  //     name,
  //     createdAt: new Date().toISOString(),
  //   };
  //   projects.push(p);
  //   return p;
  // },

  // Use cases
  getUseCases: async (projectId: string): Promise<UseCase[]> => {
    try {
      const sql = `
        SELECT *
        FROM "useCases"
        WHERE "projectId" = $1;
      `;
      const res = await pool.query(sql, [projectId]);

      return res.rows;
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
  },
  // createUseCase(name: string, projectId: string): UseCase {
  //   const u: UseCase = {
  //     id: uuid(),
  //     projectId,
  //     name,
  //     createdAt: new Date().toISOString(),
  //   };
  //   useCases.push(u);
  //   return u;
  // },

  // Data feeds
  getDataFeeds: async (useCaseId: string): Promise<DataFeed[]> => {
    try {
      const sql = `
        SELECT *
        FROM "dataFeeds"
        WHERE "useCaseId" = $1;
      `;
      const res = await pool.query(sql, [useCaseId]);

      return res.rows;
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
  },
  // createDataFeed(name: string, useCaseId: string): DataFeed {
  //   const f: DataFeed = {
  //     id: uuid(),
  //     useCaseId,
  //     name,
  //     createdAt: new Date().toISOString(),
  //   };
  //   dataFeeds.push(f);
  //   return f;
  // },

  // Plugins
  getPlugins: async (slot: PluginSlotType): Promise<Plugin[]> => {
    try {
      const sql = `
          SELECT * FROM plugins WHERE "pluginType" = $1
        `;
      const res = await pool.query(sql, [slot]);

      const plugins: Plugin[] = res.rows
        .map((row) => {
          return {
            id: row.id,
            name: row.name,
            version: row.version,
            status: row.status,
            slot: row.slot,
            code: row.code,
          };
        })
        .filter(
          (plugin) =>
            plugin.status !== "inactive" && plugin.status !== "deprecated",
        );

      const candidates = BUNDLED_DEFAULT_PLUGINS.filter(
        (plugin) => plugin.pluginType === slot,
      )
        .filter(
          (plugin) =>
            plugin.status !== "inactive" && plugin.status !== "deprecated",
        )
        .map((row) => {
          return {
            id: row.pluginId,
            name: row.pluginName,
            version: row.pluginVersion,
            status: row.status,
            slot: row.pluginType,
            code: row.bundledSourcePath, // In a real implementation, you'd read the file content here
          };
        });

      return [...candidates, ...plugins];
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
    // plugins.filter((p) => p.slot === slot)
  },
  getPluginById: async (id: string) => {
    try {
      const sql = `
          SELECT * FROM plugins 
          WHERE "pluginId" = $1
        `;
      const res = await pool.query(sql, [id]);

      if (res.rowCount === 1) {
        const row = res.rows[0];
        return {
          id: row.id,
          name: row.name,
          version: row.version,
          status: row.status,
          slot: row.slot,
          code: row.code,
        };
      }

      const candidate = BUNDLED_DEFAULT_PLUGINS.filter(
        (plugin) =>
          plugin.status !== "inactive" && plugin.status !== "deprecated",
      )
        .map((row) => {
          return {
            id: row.pluginId,
            name: row.pluginName,
            version: row.pluginVersion,
            status: row.status,
            slot: row.pluginType,
            code: row.bundledSourcePath, // In a real implementation, you'd read the file content here
          };
        })
        .find((plugin) => plugin.id === id);

      return candidate || undefined;
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
    // plugins.find((p) => p.id === id)
  },
  // createPlugin(
  //   name: string,
  //   slot: PluginSlotType,
  //   code = "// TODO: implement run()\nasync function run(payload) {\n  return { output: payload };\n}",
  // ): Plugin {
  //   const p: Plugin = {
  //     id: uuid(),
  //     name,
  //     version: "0.1.0",
  //     status: "draft",
  //     slot,
  //     code,
  //   };
  //   plugins.push(p);
  //   return p;
  // },

  // Assignments
  getAssignment: (feedId: string) =>
    assignments.find((a) => a.feedId === feedId) ?? null,
  upsertAssignment(a: DataFeedPluginAssignment): DataFeedPluginAssignment {
    const idx = assignments.findIndex((x) => x.feedId === a.feedId);
    if (idx >= 0) assignments[idx] = a;
    else assignments.push(a);
    return a;
  },
};
