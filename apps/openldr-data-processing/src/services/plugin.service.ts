import { pool } from '../lib/db';
import { logger } from '../lib/logger';

type PluginType = 'schema' | 'mapper' | 'recipient';

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
    pluginId: 'bundled-default-mapper-1.1.0',
    pluginType: 'mapper',
    pluginName: 'default-mapper',
    pluginVersion: '1.1.0',
    pluginMinioObjectPath: null,
    securityLevel: 'medium',
    config: {},
    notes: 'Bundled default mapper plugin',
    status: 'active',
    bundledSourcePath: 'src/default-plugins/mapper/default.mapper.js',
    isBundled: true,
  },
  {
    pluginId: 'bundled-default-recipient-1.1.0',
    pluginType: 'recipient',
    pluginName: 'default-recipient',
    pluginVersion: '1.1.0',
    pluginMinioObjectPath: null,
    securityLevel: 'medium',
    config: {},
    notes: 'Bundled default recipient plugin',
    status: 'active',
    bundledSourcePath: 'src/default-plugins/recipient/default.recipient.js',
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
    notes: 'Bundled default schema plugin (legacy)',
    status: 'deprecated',
    bundledSourcePath: 'src/default-plugins/schema/default.schema.1.1.0.js',
    isBundled: true,
  },
];

function compareVersions(a: string, b: string) {
  const ap = a.split('.').map((v) => Number.parseInt(v, 10) || 0);
  const bp = b.split('.').map((v) => Number.parseInt(v, 10) || 0);
  const max = Math.max(ap.length, bp.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (ap[i] || 0) - (bp[i] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export async function getPluginById({ pluginID }: { pluginID: string }) {
  try {
    const sql = `
      SELECT *
      FROM "plugins"
      WHERE "pluginId" = $1;
    `;
    const res = await pool.query(sql, [pluginID]);
    if (res.rowCount === 1) {
      return res.rows[0];
    }
    return null;
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Database query error');
    throw error;
  }
}

export function getBundledDefaultPlugin({
  pluginType,
  pluginVersion,
}: {
  pluginType: PluginType;
  pluginVersion?: string | null;
}) {
  const candidates = BUNDLED_DEFAULT_PLUGINS.filter((plugin) => plugin.pluginType === pluginType)
    .filter((plugin) => plugin.status !== 'disabled');

  if (pluginVersion) {
    const exact = candidates.find((plugin) => plugin.pluginVersion === pluginVersion);
    if (exact) {
      return exact;
    }
  }

  const preferred = [...candidates]
    .filter((plugin) => plugin.status === 'active')
    .sort((a, b) => compareVersions(b.pluginVersion, a.pluginVersion))[0]
    || [...candidates].sort((a, b) => compareVersions(b.pluginVersion, a.pluginVersion))[0];

  if (!preferred) {
    throw new Error(`No bundled default plugin available for type ${pluginType}`);
  }

  return preferred;
}

export async function resolvePluginOrDefault({
  pluginID,
  pluginType,
  pluginVersion,
}: {
  pluginID?: string | null;
  pluginType: PluginType;
  pluginVersion?: string | null;
}) {
  if (pluginID) {
    const plugin = await getPluginById({ pluginID });
    if (plugin) {
      return plugin;
    }

    logger.warn({ pluginID, pluginType }, 'Plugin not found, falling back to bundled default');
  }

  return getBundledDefaultPlugin({ pluginType, pluginVersion });
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
          ...requested,
          selection_source: 'configured-plugin',
          resolved_plugin_id: plugin.pluginId,
          resolved_plugin_name: plugin.pluginName,
          resolved_plugin_version: plugin.pluginVersion,
          is_bundled: false,
        },
      };
    }

    logger.warn({ pluginID, pluginType }, 'Plugin not found, falling back to bundled default');
  }

  const fallback = getBundledDefaultPlugin({ pluginType, pluginVersion });
  return {
    plugin: fallback,
    selection: {
      ...requested,
      selection_source: pluginID ? 'bundled-default-fallback' : 'bundled-default',
      resolved_plugin_id: fallback.pluginId,
      resolved_plugin_name: fallback.pluginName,
      resolved_plugin_version: fallback.pluginVersion,
      is_bundled: true,
    },
  };
}
