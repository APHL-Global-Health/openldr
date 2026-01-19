import { DynamicModelManager } from "@openldr/internal-database";
import express from "express";
import * as projectService from "../services/projectService";
import { v4 as uuidv4 } from "uuid";

export const router = (modelManager: DynamicModelManager) => {
  const _router = express.Router();

  _router.post("/create-project", async (req, res) => {
    const { projectName, description, isEnabled } = req.body;

    try {
      const projectId = await uuidv4();

      const project = await projectService.createProject({
        projectId,
        projectName,
        description,
        isEnabled,
      });

      res.status(200).json(project);
    } catch (error: any) {
      console.error("Error creating project:", error);
      res.status(500).send(`Failed to create project: ${error.message}`);
    }
  });

  _router.get("", async (req, res) => {
    const isEnabled = req.query.isEnabled;
    const projects = await projectService.getAllProjects(isEnabled);

    res.status(200).json(projects);
  });

  _router.put("/update-project/:id", async (req, res) => {
    const { id } = req.params;
    const { projectName, description, isEnabled } = req.body;

    try {
      await projectService.updateProject({
        projectId: id,
        projectName: projectName,
        description: description,
        isEnabled: isEnabled,
      });

      res.status(200).send(`Project updated successfully.`);
    } catch (error: any) {
      console.error(error);

      res
        .status(500)
        .send(
          `Failed to update project (${JSON.stringify(error.response ? error.response.data : error.message, null, 2)})`
        );
    }
  });

  _router.delete("/delete-project/:id", async (req, res) => {
    const { id } = req.params;

    try {
      await projectService.deleteProject(id);

      res.status(200).send(`Project deleted successfully.`);
    } catch (error: any) {
      console.error(error);

      res
        .status(500)
        .send(
          `Failed to delete project (${JSON.stringify(error.response ? error.response.data : error.message, null, 2)})`
        );
    }
  });

  return _router;
};
