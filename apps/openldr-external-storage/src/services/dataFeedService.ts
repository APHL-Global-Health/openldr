import { models } from "@openldr/internal-database";
const { DataFeedModel, ProjectModel, UseCaseModel, PluginModel } = models;

// get the data feed by id and include the associated project, use case, and plugins
async function getDataFeedById(dataFeedId: string) {
  const dataFeed = await DataFeedModel.findByPk(dataFeedId, {
    include: [
      {
        model: ProjectModel,
        as: "project",
        attributes: ["projectId", "projectName", "description", "isEnabled"],
      },
      {
        model: UseCaseModel,
        as: "useCase",
        attributes: ["useCaseId", "useCaseName", "description", "isEnabled"],
      },
      {
        model: PluginModel,
        as: "schemaPlugin",
        attributes: [
          "pluginId",
          "pluginName",
          "pluginVersion",
          "pluginType",
          "securityLevel",
          "config",
          "notes",
        ],
      },
      {
        model: PluginModel,
        as: "mapperPlugin",
        attributes: [
          "pluginId",
          "pluginName",
          "pluginVersion",
          "pluginType",
          "securityLevel",
          "config",
          "notes",
        ],
      },
      {
        model: PluginModel,
        as: "recipientPlugin",
        attributes: [
          "pluginId",
          "pluginName",
          "pluginVersion",
          "pluginType",
          "securityLevel",
          "config",
          "notes",
        ],
      },
    ],
  });

  return dataFeed;
}

export { getDataFeedById };
