import express from "express";
import { getEnryForm, getAllEntryForms } from "../services/dataEntryService";
import { DynamicModelManager } from "@openldr/internal-database";

export const router = (modelManager: DynamicModelManager) => {
  const _router = express.Router();

  _router.get("/:type", async (req, res) => {
    const type = req.params.type as string;
    try {
      const forms = await getAllEntryForms(modelManager, type);
      res.status(200).json(forms);
    } catch (error: any) {
      res.status(500).send(error.response.data || error.message);
    }
  });

  _router.get("/get-form/:name/:version/:type", async (req, res) => {
    const name = req.params.name as string;
    const version = req.params.version as string;
    const type = req.params.type as string;
    try {
      const form = await getEnryForm(modelManager, name, version, type);
      res.status(200).json(form);
    } catch (error: any) {
      res.status(500).send(error.response?.data || error.message);
    }
  });

  return _router;
};
