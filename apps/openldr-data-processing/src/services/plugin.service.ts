import { pool } from "../lib/db";
import { logger } from "../lib/logger";

import type { PluginSlotType } from "@/types/plugin.test.types";

export async function getPluginById({ pluginID }: { pluginID: string }) {
  try {
    const sql = `SELECT * FROM "plugins" WHERE "pluginId" = $1;`;
    const res = await pool.query(sql, [pluginID]);
    return res.rowCount === 1 ? res.rows[0] : null;
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Database query error",
    );
    throw error;
  }
}

export async function getDefaultBundledPluginFromDb({
  pluginType,
  pluginVersion,
}: {
  pluginType: PluginSlotType;
  pluginVersion?: string | null;
}) {
  try {
    let sql: string;
    let params: any[];

    if (pluginVersion) {
      sql = `
        SELECT * FROM plugins
        WHERE "pluginType" = $1
          AND "pluginVersion" = $2
          AND "isBundled" = true
          AND status NOT IN ('inactive', 'deprecated')
        LIMIT 1;
      `;
      params = [pluginType, pluginVersion];
    } else {
      sql = `
        SELECT * FROM plugins
        WHERE "pluginType" = $1
          AND "isBundled" = true
          AND status NOT IN ('inactive', 'deprecated')
        ORDER BY "pluginVersion" DESC
        LIMIT 1;
      `;
      params = [pluginType];
    }

    const res = await pool.query(sql, params);

    if (res.rowCount === 0) {
      throw new Error(
        `No bundled default plugin found in database for type ${pluginType}`,
      );
    }

    return res.rows[0];
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack, pluginType, pluginVersion },
      "Failed to fetch default bundled plugin from database",
    );
    throw error;
  }
}

export async function resolvePluginSelection({
  pluginID,
  pluginType,
  pluginVersion,
}: {
  pluginID?: string | null;
  pluginType: PluginSlotType;
  pluginVersion?: string | null;
}) {
  const requested = {
    plugin_id: pluginID || null,
    plugin_type: pluginType,
    plugin_version: pluginVersion || null,
  };

  if (pluginID) {
    const plugin = await getPluginById({ pluginID });
    if (plugin) {
      return {
        plugin,
        selection: {
          requested,
          resolved: {
            plugin_id: plugin.pluginId,
            plugin_name: plugin.pluginName,
            plugin_version: plugin.pluginVersion,
            plugin_type: plugin.pluginType || pluginType,
            source: "configured",
            is_bundled: false,
            fallback_used: false,
          },
        },
      };
    }

    logger.warn(
      { pluginID, pluginType },
      "Plugin not found, falling back to bundled default",
    );
  }

  const fallback = await getDefaultBundledPluginFromDb({ pluginType, pluginVersion });
  return {
    plugin: fallback,
    selection: {
      requested,
      resolved: {
        plugin_id: fallback.pluginId,
        plugin_name: fallback.pluginName,
        plugin_version: fallback.pluginVersion,
        plugin_type: fallback.pluginType,
        source: "bundled-default",
        is_bundled: true,
        fallback_used: true,
      },
    },
  };
}
