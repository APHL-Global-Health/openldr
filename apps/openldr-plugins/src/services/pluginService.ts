import { models } from "@openldr/internal-database";
const { PluginModel } = models;

interface PluginParams {
  pluginId: string;
  pluginType: string;
  pluginName: string;
  pluginVersion: string;
  pluginData?: any;
  pluginMinioObjectPath: string;
  securityLevel: string;
  config?: any;
  notes: string;
}

async function createPlugin({
  pluginId,
  pluginType,
  pluginName,
  pluginVersion,
  pluginData,
  pluginMinioObjectPath,
  securityLevel,
  config,
  notes,
}: PluginParams) {
  const plugins = await getPluginBySearch({
    pluginType,
    pluginName,
    pluginVersion,
  });
  if (plugins.length >= 1) {
    throw new Error(
      `Plugin already exists for plugin type: ${pluginType}, plugin name: ${pluginName}, and plugin version: ${pluginVersion}.`
    );
  }

  return await PluginModel.create({
    pluginId: pluginId,
    pluginType: pluginType,
    pluginName: pluginName,
    pluginVersion: pluginVersion,
    pluginMinioObjectPath: pluginMinioObjectPath,
    securityLevel: securityLevel,
    config: config,
    notes: notes,
  });
}

async function getPluginById(pluginId: string) {
  return await PluginModel.findByPk(pluginId);
}

async function getPluginBySearch({
  pluginType,
  pluginName,
  pluginVersion,
}: {
  pluginType: any;
  pluginName: any;
  pluginVersion: any;
}) {
  return await PluginModel.findAll({
    where: {
      pluginType: pluginType,
      pluginName: pluginName,
      pluginVersion: pluginVersion,
    },
  });
}

async function getAllPlugins() {
  try {
    return await PluginModel.findAll();
  } catch (error) {
    console.error("Error getting all plugins:", error);
    throw error;
  }
}

async function updatePlugin({
  pluginId,
  pluginType,
  pluginName,
  pluginVersion,
  pluginData,
  pluginMinioObjectPath,
  securityLevel,
  config,
  notes,
}: PluginParams) {
  try {
    return await PluginModel.update(
      {
        pluginType,
        pluginName,
        pluginVersion,
        // pluginData,
        pluginMinioObjectPath,
        securityLevel,
        config,
        notes,
      },
      {
        where: { pluginId },
      }
    );
  } catch (error) {
    console.error("Error updating plugin:", error);
    throw error;
  }
}

async function deletePlugin(pluginId: string) {
  try {
    return await PluginModel.destroy({
      where: { pluginId },
    });
  } catch (error) {
    console.error("Error deleting plugin:", error);
    throw error;
  }
}

async function getPluginsByType(pluginType: any) {
  try {
    return await PluginModel.findAll({
      where: {
        pluginType: pluginType,
      },
    });
  } catch (error) {
    console.error(
      `Error getting all plugins for type: {${pluginType}} :`,
      error
    );
    throw error;
  }
}

export {
  createPlugin,
  getPluginById,
  getPluginBySearch,
  getAllPlugins,
  updatePlugin,
  deletePlugin,
  getPluginsByType,
};
