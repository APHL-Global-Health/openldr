import { models } from "@openldr/internal-database";
import { DataFeedParams } from "../lib/types";
const {
  DataFeedModel,
  ProjectModel,
  FacilityModel,
  PluginModel,
  UseCaseModel,
} = models;

async function createDataFeed({
  dataFeedId,
  dataFeedName,
  facilityId,
  schemaPluginId,
  mapperPluginId,
  recipientPluginId,
  projectId,
  useCaseId,
  isEnabled,
  isProtected,
}: DataFeedParams) {
  try {
    // Convert empty strings to null for plugin IDs
    const cleanData: any = {
      dataFeedId,
      dataFeedName,
      facilityId,
      schemaPluginId: schemaPluginId === "" ? null : schemaPluginId,
      mapperPluginId: mapperPluginId === "" ? null : mapperPluginId,
      recipientPluginId: recipientPluginId === "" ? null : recipientPluginId,
      projectId,
      useCaseId,
      isEnabled,
      isProtected: isProtected !== undefined ? isProtected : false,
    };

    return await DataFeedModel.create(cleanData);
  } catch (error) {
    console.error("Error creating data feed:", error);
    throw error;
  }
}

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
  recipientPluginId,
}: {
  facilityId: string;
  schemaPluginId: string;
  mapperPluginId: string;
  recipientPluginId: string;
}) {
  try {
    return await DataFeedModel.findAll({
      where: {
        facilityId,
        schemaPluginId,
        mapperPluginId,
        recipientPluginId,
      },
    });
  } catch (error) {
    console.error("Error getting data feed by plugin IDs:", error);
    throw error;
  }
}

async function getDataFeedsByFacility(facilityId: string) {
  try {
    return await DataFeedModel.findAll({
      where: { facilityId },
    });
  } catch (error) {
    console.error("Error getting data feeds by facility:", error);
    throw error;
  }
}

async function getAllDataFeeds(isEnabled: any) {
  try {
    if (isEnabled !== undefined) {
      return await DataFeedModel.findAll({
        where: { isEnabled: isEnabled },
        include: [
          {
            model: FacilityModel,
            as: "facility",
            attributes: ["facilityName"],
          },
          {
            model: PluginModel,
            as: "schemaPlugin",
            attributes: ["pluginName"],
          },
          {
            model: PluginModel,
            as: "mapperPlugin",
            attributes: ["pluginName"],
          },
          {
            model: PluginModel,
            as: "recipientPlugin",
            attributes: ["pluginName"],
          },
          {
            model: ProjectModel,
            as: "project",
            attributes: ["projectName"],
          },
          {
            model: UseCaseModel,
            as: "useCase",
            attributes: ["useCaseName"],
          },
        ],
      });
    } else {
      return await DataFeedModel.findAll({
        include: [
          {
            model: FacilityModel,
            as: "facility",
            attributes: ["facilityName"],
          },
          {
            model: PluginModel,
            as: "schemaPlugin",
            attributes: ["pluginName"],
          },
          {
            model: PluginModel,
            as: "mapperPlugin",
            attributes: ["pluginName"],
          },
          {
            model: PluginModel,
            as: "recipientPlugin",
            attributes: ["pluginName"],
          },
          {
            model: ProjectModel,
            as: "project",
            attributes: ["projectName"],
          },
          {
            model: UseCaseModel,
            as: "useCase",
            attributes: ["useCaseName"],
          },
        ],
      });
    }
  } catch (error) {
    console.error("Error getting all data feeds:", error);
    throw error;
  }
}

async function updateDataFeed({
  dataFeedId,
  dataFeedName,
  facilityId,
  schemaPluginId,
  mapperPluginId,
  recipientPluginId,
  projectId,
  useCaseId,
  isEnabled,
  isProtected,
}: DataFeedParams) {
  try {
    // Convert empty strings to null for plugin IDs
    const cleanData: any = {
      dataFeedName,
      facilityId,
      schemaPluginId: schemaPluginId === "" ? null : schemaPluginId,
      mapperPluginId: mapperPluginId === "" ? null : mapperPluginId,
      recipientPluginId: recipientPluginId === "" ? null : recipientPluginId,
      projectId,
      useCaseId,
      isEnabled,
      isProtected,
    };

    return await DataFeedModel.update(cleanData, {
      where: { dataFeedId },
    });
  } catch (error) {
    console.error("Error updating data feed:", error);
    throw error;
  }
}

async function deleteDataFeed(dataFeedId: string) {
  try {
    return await DataFeedModel.destroy({
      where: { dataFeedId },
    });
  } catch (error) {
    console.error("Error deleting data feed:", error);
    throw error;
  }
}

async function createManualDataEntryDataFeed({
  dataFeedId,
  facilityId,
  facilityName,
  projectId,
  useCaseId,
}: {
  dataFeedId: string;
  facilityId: string;
  facilityName: string;
  projectId: string;
  useCaseId: string;
}) {
  return await createDataFeed({
    dataFeedId,
    dataFeedName: `Manual Data Entry for Facility: ${facilityName}`,
    facilityId,
    schemaPluginId: null,
    mapperPluginId: null,
    recipientPluginId: null,
    projectId,
    useCaseId,
    isEnabled: true,
    isProtected: true,
  });
}

export {
  createDataFeed,
  getDataFeedById,
  getDataFeedByPluginIds,
  getDataFeedsByFacility,
  getAllDataFeeds,
  updateDataFeed,
  deleteDataFeed,
  createManualDataEntryDataFeed,
};
