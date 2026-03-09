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

  // Assignments
  getAssignment: async (
    feedId: string,
  ): Promise<DataFeedPluginAssignment | null> => {
    try {
      const sql = `
        SELECT "dataFeedId", "schemaPluginId", "mapperPluginId", "recipientPluginId"
        FROM "dataFeeds"
        WHERE "dataFeedId" = $1;
      `;
      const res = await pool.query(sql, [feedId]);
      if (res.rowCount === 1) {
        const row = res.rows[0];
        return {
          feedId: row.dataFeedId,
          validationPluginId: row.schemaPluginId ?? null,
          mappingPluginId: row.mapperPluginId ?? null,
          outpostPluginId: row.recipientPluginId ?? null,
        };
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

  upsertAssignment: async (
    a: DataFeedPluginAssignment,
  ): Promise<DataFeedPluginAssignment> => {
    try {
      // Bundled plugins only exist in memory — their IDs are not in the plugins
      // table, so they would violate the FK constraint. Store null for those
      // columns; the runtime resolves bundled plugins by ID from memory.
      const bundledIds = new Set(
        BUNDLED_DEFAULT_PLUGINS.map((p) => p.pluginId),
      );
      const toDb = (id: string | null) =>
        id && !bundledIds.has(id) ? id : null;

      const sql = `
        UPDATE "dataFeeds"
        SET "schemaPluginId"    = $2,
            "mapperPluginId"    = $3,
            "recipientPluginId" = $4
        WHERE "dataFeedId" = $1;
      `;
      await pool.query(sql, [
        a.feedId,
        toDb(a.validationPluginId),
        toDb(a.mappingPluginId),
        toDb(a.outpostPluginId),
      ]);
      return a;
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
  },
};
