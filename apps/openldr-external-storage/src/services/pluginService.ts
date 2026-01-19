import { models } from "@openldr/internal-database";
const { PluginModel } = models;

// get the plugin by id
async function getPluginById({ pluginID }: { pluginID: any }) {
  const plugin = await PluginModel.findByPk(pluginID);
  return plugin;
}

export { getPluginById };
