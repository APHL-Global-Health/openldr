import { models } from "@openldr/internal-database";
import { Op } from "@sequelize/core";
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

// get the default manual entry data feed for a facility
// finds the most recent data feed for the facility with use case containing "Manual"
async function getDefaultManualEntryDataFeed(facilityId: string) {
  const dataFeed = await DataFeedModel.findOne({
    where: {
      facilityId: facilityId,
      isEnabled: true,
    },
    include: [
      {
        model: ProjectModel,
        as: "project",
        attributes: ["projectId", "projectName", "description", "isEnabled"],
      },
      {
        model: UseCaseModel,
        as: "useCase",
        where: {
          useCaseName: {
            [Op.like]: "%Manual%",
          },
          isEnabled: true,
        },
        attributes: ["useCaseId", "useCaseName", "description", "isEnabled"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return dataFeed;
}

export { getDataFeedById, getDefaultManualEntryDataFeed };
