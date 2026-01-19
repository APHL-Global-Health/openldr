import { models } from "@openldr/internal-database";
import { ProjectParams } from "../lib/types";
const { ProjectModel } = models;

async function createProject({
  projectId,
  projectName,
  description,
  isEnabled,
}: ProjectParams) {
  try {
    return await ProjectModel.create({
      projectId,
      projectName,
      description,
      isEnabled,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
}

async function getAllProjects(isEnabled: any) {
  try {
    if (isEnabled !== undefined) {
      return await ProjectModel.findAll({
        where: {
          isEnabled: isEnabled,
        },
      });
    } else {
      return await ProjectModel.findAll();
    }
  } catch (error) {
    console.error("Error getting all projects:", error);
    throw error;
  }
}

async function updateProject({
  projectId,
  projectName,
  description,
  isEnabled,
}: ProjectParams) {
  try {
    return await ProjectModel.update(
      { projectName, description, isEnabled },
      {
        where: { projectId },
      }
    );
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
}

async function deleteProject(projectId: string) {
  try {
    return await ProjectModel.destroy({
      where: { projectId },
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
}

export { createProject, getAllProjects, updateProject, deleteProject };
