import express from "express";
import { query } from "../services/database.service";

const router = express.Router();

// POST /api/results - Create new lab result
router.post("/", async (req, res) => {
  try {
    const {
      lab_requests_id,
      obx_set_id,
      observation_code,
      observation_desc,
      rpt_result,
      rpt_units,
      rpt_flag,
      result_timestamp,
      result_data,
    } = req.body;

    // Validate required fields
    if (!lab_requests_id) {
      return res.status(400).json({
        error: "Validation Error",
        message: "lab_requests_id is required",
        status_code: 400,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if the request exists
    const existingRequest = await query(
      "SELECT lab_requests_id FROM lab_requests WHERE lab_requests_id = $1",
      [lab_requests_id],
    );

    if (existingRequest.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Lab request not found",
        status_code: 404,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if result already exists (based on lab_requests_id and obx_set_id)
    if (obx_set_id) {
      const existingResult = await query(
        "SELECT lab_results_id, lab_requests_id, obx_set_id, observation_code, created_at FROM lab_results WHERE lab_requests_id = $1 AND obx_set_id = $2",
        [lab_requests_id, obx_set_id],
      );

      if (existingResult.rows.length > 0) {
        // Return existing result instead of error (idempotent behavior)
        return res.status(200).json({
          message: "Lab result already exists",
          data: existingResult.rows[0],
          status_code: 200,
          duplicate: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Insert new result
    const result = await query(
      `INSERT INTO lab_results (
        lab_requests_id, obx_set_id, observation_code, observation_desc,
        rpt_result, rpt_units, rpt_flag, result_timestamp, result_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING lab_results_id, lab_requests_id, observation_code, created_at`,
      [
        lab_requests_id,
        obx_set_id,
        observation_code,
        observation_desc,
        rpt_result,
        rpt_units,
        rpt_flag,
        result_timestamp,
        result_data,
      ],
    );

    res.status(201).json({
      message: "Lab result created successfully",
      data: result.rows[0],
      status_code: 201,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating lab result:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create lab result",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/results - List lab results with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      lab_requests_id,
      observation_code,
      rpt_flag,
      limit = 50,
      offset = 0,
      sort_by = "created_at",
      sort_order = "DESC",
    } = req.query;

    // Build WHERE clause
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (lab_requests_id) {
      paramCount++;
      whereConditions.push(`lr.lab_requests_id = $${paramCount}`);
      params.push(lab_requests_id);
    }

    if (observation_code) {
      paramCount++;
      whereConditions.push(`lres.observation_code = $${paramCount}`);
      params.push(observation_code);
    }

    if (rpt_flag) {
      paramCount++;
      whereConditions.push(`lres.rpt_flag = $${paramCount}`);
      params.push(rpt_flag);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Validate sort parameters
    const allowedSortFields = [
      "created_at",
      "result_timestamp",
      "observation_code",
      "rpt_flag",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortByStr = typeof sort_by === "string" ? sort_by : "created_at";
    const sortOrderStr = typeof sort_order === "string" ? sort_order : "DESC";

    const sortField = allowedSortFields.includes(sortByStr)
      ? sortByStr
      : "created_at";
    const sortDirection = allowedSortOrders.includes(sortOrderStr.toUpperCase())
      ? sortOrderStr.toUpperCase()
      : "DESC";
    // Get total count
    const countResult: any = await query(
      `SELECT COUNT(*) as total 
       FROM lab_results lres
       JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
       ${whereClause}`,
      params,
    );

    // Get paginated results with request info
    const limitNum = typeof limit === "string" ? parseInt(limit) : 50;
    const offsetNum = typeof offset === "string" ? parseInt(offset) : 0;
    const result: any = await query(
      `SELECT 
        lres.lab_results_id, lres.lab_requests_id, lres.obx_set_id,
        lres.observation_code, lres.observation_desc, lres.rpt_result,
        lres.rpt_units, lres.rpt_flag, lres.result_timestamp,
        lres.created_at,
        lr.request_id, lr.facility_code, lr.panel_code
      FROM lab_results lres
      JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
      ${whereClause}
      ORDER BY lres.${sortField} ${sortDirection}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limitNum, offsetNum],
    );

    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: limitNum,
        offset: offsetNum,
        has_more: result.rows.length === limitNum,
      },
      status_code: 200,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching lab results:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch lab results",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/results/:id - Get specific lab result
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        lres.lab_results_id, lres.lab_requests_id, lres.obx_set_id,
        lres.observation_code, lres.observation_desc, lres.rpt_result,
        lres.rpt_units, lres.rpt_flag, lres.result_timestamp,
        lres.result_data, lres.created_at,
        lr.request_id, lr.facility_code, lr.panel_code, lr.panel_desc
      FROM lab_results lres
      JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
      WHERE lres.lab_results_id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Lab result not found",
        status_code: 404,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      data: result.rows[0],
      status_code: 200,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching lab result:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch lab result",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /api/results/:id - Update lab result
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      obx_set_id,
      observation_code,
      observation_desc,
      rpt_result,
      rpt_units,
      rpt_flag,
      result_timestamp,
      result_data,
      status,
    } = req.body;

    // Check if result exists
    const existingResult = await query(
      "SELECT lab_results_id FROM lab_results WHERE lab_results_id = $1",
      [id],
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Lab result not found",
        status_code: 404,
        timestamp: new Date().toISOString(),
      });
    }

    // Build UPDATE query dynamically
    const updateFields = [];
    const params = [];
    let paramCount = 0;

    if (obx_set_id !== undefined) {
      paramCount++;
      updateFields.push(`obx_set_id = $${paramCount}`);
      params.push(obx_set_id);
    }

    if (observation_code !== undefined) {
      paramCount++;
      updateFields.push(`observation_code = $${paramCount}`);
      params.push(observation_code);
    }

    if (observation_desc !== undefined) {
      paramCount++;
      updateFields.push(`observation_desc = $${paramCount}`);
      params.push(observation_desc);
    }

    if (rpt_result !== undefined) {
      paramCount++;
      updateFields.push(`rpt_result = $${paramCount}`);
      params.push(rpt_result);
    }

    if (rpt_units !== undefined) {
      paramCount++;
      updateFields.push(`rpt_units = $${paramCount}`);
      params.push(rpt_units);
    }

    if (rpt_flag !== undefined) {
      paramCount++;
      updateFields.push(`rpt_flag = $${paramCount}`);
      params.push(rpt_flag);
    }

    if (result_timestamp !== undefined) {
      paramCount++;
      updateFields.push(`result_timestamp = $${paramCount}`);
      params.push(result_timestamp);
    }

    if (result_data !== undefined) {
      paramCount++;
      updateFields.push(`result_data = $${paramCount}`);
      params.push(result_data);
    }

    if (status !== undefined) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "No fields to update",
        status_code: 400,
        timestamp: new Date().toISOString(),
      });
    }

    // Add the ID parameter
    paramCount++;
    params.push(id);

    const result = await query(
      `UPDATE lab_results 
       SET ${updateFields.join(", ")}
       WHERE lab_results_id = $${paramCount}
       RETURNING lab_results_id, lab_requests_id, observation_code`,
      params,
    );

    res.json({
      message: "Lab result updated successfully",
      data: result.rows[0],
      status_code: 200,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating lab result:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to update lab result",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /api/results/:id - Delete lab result
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if result exists
    const existingResult = await query(
      "SELECT lab_results_id FROM lab_results WHERE lab_results_id = $1",
      [id],
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Lab result not found",
        status_code: 404,
        timestamp: new Date().toISOString(),
      });
    }

    // Delete the result
    await query("DELETE FROM lab_results WHERE lab_results_id = $1", [id]);

    res.json({
      message: "Lab result deleted successfully",
      status_code: 200,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error deleting lab result:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to delete lab result",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
