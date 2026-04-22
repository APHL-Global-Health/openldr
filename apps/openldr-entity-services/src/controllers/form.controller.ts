import express from "express";
import { getEntryForm, getAllEntryForms } from "../services/form.service";

const router = express.Router();

router.get("/:type", async (req, res) => {
  const type = req.params.type!;
  try {
    const forms = await getAllEntryForms(type);
    res.status(200).json(forms);
  } catch (error: any) {
    res.status(500).send(error.response.data || error.message);
  }
});

router.get("/form/:name/:version/:type", async (req, res) => {
  const name = req.params.name!;
  const version = req.params.version;
  const type = req.params.type;
  try {
    const form = await getEntryForm(name, version, type);
    res.status(200).json(form);
  } catch (error: any) {
    res.status(500).send(error.response?.data || error.message);
  }
});

export default router;
