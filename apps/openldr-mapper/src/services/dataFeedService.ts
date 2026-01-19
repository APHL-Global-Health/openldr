import { models } from "@openldr/internal-database";
const { DataFeedModel, ProjectModel, UseCaseModel } = models;

// get the data feed by id and include the associated project and use case
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
    ],
  });

  return dataFeed;
}

export { getDataFeedById };
