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
import { getObject } from "../services/minio.service";

async function readMinioObjectAsString(objectPath: string): Promise<string> {
  const stream = await getObject({
    bucketName: "plugins",
    objectName: objectPath,
  });
  let output = "";
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: any) => (output += chunk.toString()));
    stream.on("end", () => resolve());
    stream.on("error", (err: any) => reject(err));
  });
  return output;
}

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

  // Plugins — all plugins (including bundled) are now stored in the database
  // and their source code is stored in MinIO.
  getPlugins: async (slot: PluginSlotType): Promise<Plugin[]> => {
    try {
      const sql = `
        SELECT "pluginId", "pluginName", "pluginVersion", status, "pluginType", "pluginMinioObjectPath", "securityLevel", "isBundled", "createdAt"
        FROM plugins
        WHERE "pluginType" = $1
          AND status NOT IN ('inactive', 'deprecated')
        ORDER BY "isBundled" DESC, "pluginVersion" DESC;
      `;
      const res = await pool.query(sql, [slot]);

      return res.rows;
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
  },

  getPluginById: async (id: string): Promise<Plugin | undefined> => {
    try {
      const sql = `
        SELECT "pluginId", "pluginName", "pluginVersion", status, "pluginType", "pluginMinioObjectPath", "securityLevel", "isBundled", "createdAt"
        FROM plugins
        WHERE "pluginId" = $1;
      `;
      const res = await pool.query(sql, [id]);

      if (res.rowCount !== 1) return undefined;

      const row = res.rows[0];
      const code = await readMinioObjectAsString(row.pluginMinioObjectPath);

      return {
        pluginId: row.pluginId,
        pluginName: row.pluginName,
        pluginVersion: row.pluginVersion,
        status: row.status,
        pluginType: row.pluginType,
        pluginMinioObjectPath: code,
        securityLevel: row.securityLevel,
        isBundled: row.isBundled,
        createdAt: row.createdAt,
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
  },

  // Assignments
  getAssignment: async (
    feedId: string,
  ): Promise<DataFeedPluginAssignment | null> => {
    try {
      const sql = `
        SELECT "dataFeedId", "schemaPluginId", "mapperPluginId", "storagePluginId", "outpostPluginId"
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
          storagePluginId: row.storagePluginId ?? null,
          outpostPluginId: row.outpostPluginId ?? null,
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
      // Bundled plugin IDs are now stored in the database, so all plugin IDs
      // (including bundled ones) can be stored directly as FK references.
      const sql = `
        UPDATE "dataFeeds"
        SET "schemaPluginId"    = $2,
            "mapperPluginId"    = $3,
            "storagePluginId"   = $4,
            "outpostPluginId"   = $5
        WHERE "dataFeedId" = $1;
      `;
      await pool.query(sql, [
        a.feedId,
        a.validationPluginId,
        a.mappingPluginId,
        a.storagePluginId,
        a.outpostPluginId,
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
