import { models } from "@openldr/internal-database";
import { UseCaseParams } from "../lib/types";
const { UseCaseModel } = models;

async function createUseCase({
  useCaseId,
  useCaseName,
  description,
  isEnabled,
}: UseCaseParams) {
  try {
    return await UseCaseModel.create({
      useCaseId,
      useCaseName,
      description,
      isEnabled,
    });
  } catch (error) {
    console.error("Error creating useCase:", error);
    throw error;
  }
}

async function getAllUseCases(isEnabled: any) {
  try {
    if (isEnabled !== undefined) {
      return await UseCaseModel.findAll({
        where: {
          isEnabled: isEnabled,
        },
      });
    } else {
      return await UseCaseModel.findAll();
    }
  } catch (error) {
    console.error("Error getting all useCases:", error);
    throw error;
  }
}

async function updateUseCase({
  useCaseId,
  useCaseName,
  description,
  isEnabled,
}: UseCaseParams) {
  try {
    return await UseCaseModel.update(
      { useCaseName, description, isEnabled },
      {
        where: { useCaseId },
      }
    );
  } catch (error) {
    console.error("Error updating useCase:", error);
    throw error;
  }
}

async function deleteUseCase(useCaseId: string) {
  try {
    return await UseCaseModel.destroy({
      where: { useCaseId },
    });
  } catch (error) {
    console.error("Error deleting useCase:", error);
    throw error;
  }
}

export { createUseCase, getAllUseCases, updateUseCase, deleteUseCase };
