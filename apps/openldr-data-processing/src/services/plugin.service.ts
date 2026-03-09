import { pool } from "../lib/db";
import { logger } from "../lib/logger";

import { BUNDLED_DEFAULT_PLUGINS } from "../lib/constants";
import type { PluginSlotType } from "@/types/plugin.test.types";

function compareVersions(a: string, b: string) {
  const ap = a.split(".").map((v) => Number.parseInt(v, 10) || 0);
  const bp = b.split(".").map((v) => Number.parseInt(v, 10) || 0);
  const max = Math.max(ap.length, bp.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (ap[i] || 0) - (bp[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

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

export function getBundledDefaultPlugin({
  pluginType,
  pluginVersion,
}: {
  pluginType: PluginSlotType;
  pluginVersion?: string | null;
}) {
  const candidates = BUNDLED_DEFAULT_PLUGINS.filter(
    (plugin) => plugin.pluginType === pluginType,
  ).filter(
    (plugin) => plugin.status !== "inactive" && plugin.status !== "deprecated",
  );

  if (pluginVersion) {
    const exact = candidates.find(
      (plugin) => plugin.pluginVersion === pluginVersion,
    );
    if (exact) return exact;
  }

  const preferred = [...candidates].sort((a, b) =>
    compareVersions(b.pluginVersion, a.pluginVersion),
  )[0];
  if (!preferred)
    throw new Error(
      `No bundled default plugin available for type ${pluginType}`,
    );
  return preferred;
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

  const fallback = getBundledDefaultPlugin({ pluginType, pluginVersion });
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
