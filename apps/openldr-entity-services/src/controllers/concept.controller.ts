import express from "express";
import {
  getCodingSystems,
  getCodingSystemById,
  getCodingSystemByCode,
  getCodingSystemStats,
  getCodingSystemsWithStats,
  createCodingSystem,
  updateCodingSystem,
  deleteCodingSystem,
  getConceptsBySystem,
  searchConcepts,
  getConceptById,
  getConceptClasses,
  createConcept,
  updateConcept,
  deleteConcept,
  getMappingsByConceptId,
  getMappingsToConceptId,
  createMapping,
  updateMapping,
  deleteMapping,
} from "../services/concept.service";

const router = express.Router();

// ── Coding Systems ──────────────────────────────────────────────────────

router.get("/systems", async (req, res) => {
  try {
    const { system_type, is_active, include_stats } = req.query;
    const filters = {
      system_type: system_type as string | undefined,
      is_active: is_active !== undefined ? is_active === "true" : undefined,
    };
    const data =
      include_stats === "true"
        ? await getCodingSystemsWithStats(filters)
        : await getCodingSystems(filters);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/systems/code/:code", async (req, res) => {
  try {
    const data = await getCodingSystemByCode(req.params.code);
    if (!data) return res.status(404).json({ success: false, error: "Coding system not found" });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/systems/:id", async (req, res) => {
  try {
    const data = await getCodingSystemById(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: "Coding system not found" });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/systems/:id/stats", async (req, res) => {
  try {
    const data = await getCodingSystemStats(req.params.id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/systems", async (req, res) => {
  try {
    const { system_code, system_name } = req.body;
    if (!system_code || !system_name) {
      return res.status(400).json({
        success: false,
        error: "system_code and system_name are required",
      });
    }
    const data = await createCodingSystem(req.body);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    if (error.message?.includes("duplicate key") || error.code === "23505") {
      return res.status(409).json({ success: false, error: "A coding system with this code already exists" });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/systems/:id", async (req, res) => {
  try {
    const data = await updateCodingSystem(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, error: "Coding system not found" });
    res.json({ success: true, data });
  } catch (error: any) {
    if (error.message?.includes("duplicate key") || error.code === "23505") {
      return res.status(409).json({ success: false, error: "A coding system with this code already exists" });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/systems/:id", async (req, res) => {
  try {
    const hard = req.query.hard === "true";
    const data = await deleteCodingSystem(req.params.id, hard);
    if (!data) return res.status(404).json({ success: false, error: "Coding system not found" });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Concepts ────────────────────────────────────────────────────────────

router.get("/concepts/search", async (req, res) => {
  try {
    const { q, system_id, limit } = req.query;
    if (!q) return res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
    const data = await searchConcepts(q as string, {
      system_id: system_id as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/concepts/classes/:systemId", async (req, res) => {
  try {
    const data = await getConceptClasses(req.params.systemId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/concepts/:id/mappings", async (req, res) => {
  try {
    const from = await getMappingsByConceptId(req.params.id);
    const to = await getMappingsToConceptId(req.params.id);
    res.json({ success: true, data: { from, to } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/concepts/:id", async (req, res) => {
  try {
    const data = await getConceptById(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: "Concept not found" });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/concepts", async (req, res) => {
  try {
    const { system_id, search, concept_class, is_active, page, limit } = req.query;
    if (!system_id) {
      return res.status(400).json({ success: false, error: "Query parameter 'system_id' is required" });
    }
    const data = await getConceptsBySystem(system_id as string, {
      search: search as string | undefined,
      concept_class: concept_class as string | undefined,
      is_active: is_active !== undefined ? is_active === "true" : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/concepts", async (req, res) => {
  try {
    const { system_id, concept_code, display_name } = req.body;
    if (!system_id || !concept_code || !display_name) {
      return res.status(400).json({
        success: false,
        error: "system_id, concept_code, and display_name are required",
      });
    }
    const data = await createConcept(req.body);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    if (error.message?.includes("duplicate key") || error.code === "23505") {
      return res.status(409).json({ success: false, error: "A concept with this code already exists in this system" });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/concepts/:id", async (req, res) => {
  try {
    const data = await updateConcept(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, error: "Concept not found" });
    res.json({ success: true, data });
  } catch (error: any) {
    if (error.message?.includes("duplicate key") || error.code === "23505") {
      return res.status(409).json({ success: false, error: "A concept with this code already exists in this system" });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/concepts/:id", async (req, res) => {
  try {
    const hard = req.query.hard === "true";
    const data = await deleteConcept(req.params.id, hard);
    if (!data) return res.status(404).json({ success: false, error: "Concept not found" });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Mappings ────────────────────────────────────────────────────────────

router.post("/mappings", async (req, res) => {
  try {
    const { from_concept_id, map_type } = req.body;
    if (!from_concept_id || !map_type) {
      return res.status(400).json({
        success: false,
        error: "from_concept_id and map_type are required",
      });
    }
    const data = await createMapping(req.body);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/mappings/:id", async (req, res) => {
  try {
    const data = await updateMapping(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, error: "Mapping not found" });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/mappings/:id", async (req, res) => {
  try {
    const data = await deleteMapping(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: "Mapping not found" });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
