import { pool } from '../lib/db';
import { logger } from '../lib/logger';

export type PluginType = 'schema' | 'mapper' | 'storage' | 'outpost';

type BundledPlugin = {
  pluginId: string;
  pluginType: PluginType;
  pluginName: string;
  pluginVersion: string;
  pluginMinioObjectPath: null;
  securityLevel: 'medium' | 'low' | 'high';
  config: Record<string, any>;
  notes: string;
  status: 'active' | 'deprecated' | 'disabled';
  bundledSourcePath: string;
  isBundled: true;
};

const BUNDLED_DEFAULT_PLUGINS: BundledPlugin[] = [
  {
    pluginId: 'bundled-default-schema-1.2.0',
    pluginType: 'schema',
    pluginName: 'default-schema',
    pluginVersion: '1.2.0',
    pluginMinioObjectPath: null,
    securityLevel: 'medium',
    config: {},
    notes: 'Bundled default schema plugin',
    status: 'active',
    bundledSourcePath: 'src/default-plugins/schema/default.schema.js',
    isBundled: true,
  },
  {
    pluginId: 'bundled-default-schema-1.1.0',
    pluginType: 'schema',
    pluginName: 'default-schema',
    pluginVersion: '1.1.0',
    pluginMinioObjectPath: null,
    securityLevel: 'medium',
    config: {},
    notes: 'Bundled deprecated schema plugin',
    status: 'deprecated',
    bundledSourcePath: 'src/default-plugins/schema/default.schema.1.1.0.js',
    isBundled: true,
  },
  {
    pluginId: 'bundled-default-mapper-1.2.0',
    pluginType: 'mapper',
    pluginName: 'default-mapper',
    pluginVersion: '1.2.0',
    pluginMinioObjectPath: null,
    securityLevel: 'medium',
    config: {},
    notes: 'Bundled default mapper plugin',
    status: 'active',
    bundledSourcePath: 'src/default-plugins/mapper/default.mapper.js',
    isBundled: true,
  },
  {
    pluginId: 'bundled-default-storage-1.2.0',
    pluginType: 'storage',
    pluginName: 'default-storage',
    pluginVersion: '1.2.0',
    pluginMinioObjectPath: null,
    securityLevel: 'medium',
    config: {},
    notes: 'Bundled default storage plugin',
    status: 'active',
    bundledSourcePath: 'src/default-plugins/storage/default.storage.js',
    isBundled: true,
  },
  {
    pluginId: 'bundled-default-outpost-1.0.0',
    pluginType: 'outpost',
    pluginName: 'default-outpost',
    pluginVersion: '1.0.0',
    pluginMinioObjectPath: null,
    securityLevel: 'medium',
    config: {},
    notes: 'Bundled default outpost plugin',
    status: 'active',
    bundledSourcePath: 'src/default-plugins/outpost/default.outpost.js',
    isBundled: true,
  },
];

function compareVersions(a: string, b: string) {
  const ap = a.split('.').map((v) => Number.parseInt(v, 10) || 0);
  const bp = b.split('.').map((v) => Number.parseInt(v, 10) || 0);
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
    logger.error({ error: error.message, stack: error.stack }, 'Database query error');
    throw error;
  }
}

export function getBundledDefaultPlugin({ pluginType, pluginVersion }: { pluginType: PluginType; pluginVersion?: string | null }) {
  const candidates = BUNDLED_DEFAULT_PLUGINS.filter((plugin) => plugin.pluginType === pluginType).filter(
    (plugin) => plugin.status !== 'disabled',
  );

  if (pluginVersion) {
    const exact = candidates.find((plugin) => plugin.pluginVersion === pluginVersion);
    if (exact) return exact;
  }

  const preferred = [...candidates].sort((a, b) => compareVersions(b.pluginVersion, a.pluginVersion))[0];
  if (!preferred) throw new Error(`No bundled default plugin available for type ${pluginType}`);
  return preferred;
}

export async function resolvePluginSelection({
  pluginID,
  pluginType,
  pluginVersion,
}: {
  pluginID?: string | null;
  pluginType: PluginType;
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
            source: 'configured',
            is_bundled: false,
            fallback_used: false,
          },
        },
      };
    }

    logger.warn({ pluginID, pluginType }, 'Plugin not found, falling back to bundled default');
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
        source: 'bundled-default',
        is_bundled: true,
        fallback_used: true,
      },
    },
  };
}
