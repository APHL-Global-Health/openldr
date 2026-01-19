import { models } from "@openldr/internal-database";
const { DataFeedModel } = models;

async function getDataFeedById(dataFeedId: string) {
  try {
    return await DataFeedModel.findByPk(dataFeedId);
  } catch (error) {
    console.error("Error getting data feed by ID:", error);
    throw error;
  }
}

async function getDataFeedByPluginIds({
  facilityId,
  schemaPluginId,
  mapperPluginId,
}: {
  facilityId: string;
  schemaPluginId: string;
  mapperPluginId: string;
}) {
  try {
    return await DataFeedModel.findAll({
      where: {
        facilityId,
        schemaPluginId,
        mapperPluginId,
      },
    });
  } catch (error) {
    console.error("Error getting data feed by plugin IDs:", error);
    throw error;
  }
}

export { getDataFeedById, getDataFeedByPluginIds };
