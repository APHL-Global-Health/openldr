import { models } from "@openldr/internal-database";
const { PluginModel } = models;

async function getPluginById({ pluginID }: { pluginID: string }) {
  return await PluginModel.findByPk(pluginID);
}

export { getPluginById };
