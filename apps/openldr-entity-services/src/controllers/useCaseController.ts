import { DynamicModelManager } from "@openldr/internal-database";
import express from "express";
import * as useCaseService from "../services/useCaseService";
import { v4 as uuidv4 } from "uuid";

export const router = (modelManager: DynamicModelManager) => {
  const _router = express.Router();

  _router.post("/create-useCase", async (req, res) => {
    const { useCaseName, description, isEnabled } = req.body;

    try {
      const useCaseId = await uuidv4();

      const useCase = await useCaseService.createUseCase({
        useCaseId,
        useCaseName,
        description,
        isEnabled,
      });

      res.status(200).json(useCase);
    } catch (error: any) {
      console.error("Error creating use case:", error);
      res.status(500).send(`Failed to create use case: ${error.message}`);
    }
  });

  _router.get("", async (req, res) => {
    const isEnabled = req.query.isEnabled;
    const useCases = await useCaseService.getAllUseCases(isEnabled);

    res.status(200).json(useCases);
  });

  _router.put("/update-useCase/:id", async (req, res) => {
    const { id } = req.params;
    const { useCaseName, description, isEnabled } = req.body;

    try {
      await useCaseService.updateUseCase({
        useCaseId: id,
        useCaseName: useCaseName,
        description: description,
        isEnabled: isEnabled,
      });

      res.status(200).send(`Use case updated successfully.`);
    } catch (error: any) {
      console.error(error);

      res
        .status(500)
        .send(
          `Failed to update use case (${JSON.stringify(error.response ? error.response.data : error.message, null, 2)})`
        );
    }
  });

  _router.delete("/delete-useCase/:id", async (req, res) => {
    const { id } = req.params;

    try {
      await useCaseService.deleteUseCase(id);

      res.status(200).send(`Use case deleted successfully.`);
    } catch (error: any) {
      console.error(error);

      res
        .status(500)
        .send(
          `Failed to delete use case (${JSON.stringify(error.response ? error.response.data : error.message, null, 2)})`
        );
    }
  });

  return _router;
};
