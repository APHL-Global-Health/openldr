import express from "express";
import { query, getClient } from "../services/database";

const router = express.Router();

// POST /api/requests - Create new lab request
router.post("/", async (req, res) => {
  try {
    const {
      request_id,
      facility_code,
      facility_id,
      facility_name,
      patient_id,
      obr_set_id,
      panel_code,
      panel_desc,
      specimen_datetime,
      request_data,
      mappings,
    } = req.body;

    // Validate required fields
    if (!request_id || !facility_code) {
      return res.status(400).json({
        error: "Validation Error",
        message: "request_id and facility_code are required",
        status_code: 400,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if request already exists
    const existingRequest = await query(
      "SELECT lab_requests_id, request_id, facility_code, created_at, obr_set_id FROM lab_requests WHERE request_id = $1 AND facility_code = $2 AND obr_set_id = $3",
      [request_id, facility_code, obr_set_id]
    );

    if (existingRequest.rows.length > 0) {
      // Return existing request instead of error (idempotent behavior)
      return res.status(200).json({
        message: "Lab request already exists",
        data: existingRequest.rows[0],
        status_code: 200,
        duplicate: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Insert new request
    const result = await query(
      `INSERT INTO lab_requests (
        request_id, facility_code, facility_id, facility_name, patient_id,
        obr_set_id, panel_code, panel_desc, specimen_datetime, request_data, mappings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING lab_requests_id, request_id, facility_code, created_at`,
      [
        request_id,
        facility_code,
        facility_id,
        facility_name,
        patient_id,
        obr_set_id,
        panel_code,
        panel_desc,
        specimen_datetime,
        request_data,
        mappings,
      ]
    );

    res.status(201).json({
      message: "Lab request created successfully",
      data: result.rows[0],
      status_code: 201,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating lab request:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create lab request",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/requests - List lab requests with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      facility_code,
      patient_id,
      panel_code,
      limit = 50,
      offset = 0,
      sort_by = "created_at",
      sort_order = "DESC",
    } = req.query;

    // Build WHERE clause
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (facility_code) {
      paramCount++;
      whereConditions.push(`facility_code = $${paramCount}`);
      params.push(facility_code);
    }

    if (patient_id) {
      paramCount++;
      whereConditions.push(`patient_id = $${paramCount}`);
      params.push(patient_id);
    }

    if (panel_code) {
      paramCount++;
      whereConditions.push(`panel_code = $${paramCount}`);
      params.push(panel_code);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Validate sort parameters
    const allowedSortFields = [
      "created_at",
      "specimen_datetime",
      "request_id",
      "facility_code",
      "panel_code",
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
      `SELECT COUNT(*) as total FROM lab_requests ${whereClause}`,
      params
    );

    // Get paginated results
    const limitNum = typeof limit === "string" ? parseInt(limit) : 50;
    const offsetNum = typeof offset === "string" ? parseInt(offset) : 0;
    const result: any = await query(
      `SELECT 
        lab_requests_id, request_id, facility_code, facility_id, facility_name,
        patient_id, obr_set_id, panel_code, panel_desc, specimen_datetime,
        created_at, updated_at
      FROM lab_requests 
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limitNum, offsetNum]
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
    console.error("Error fetching lab requests:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch lab requests",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/requests/:id - Get specific lab request
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        lab_requests_id, request_id, facility_code, facility_id, facility_name,
        patient_id, obr_set_id, panel_code, panel_desc, specimen_datetime, request_data,
        mappings, created_at, updated_at
      FROM lab_requests 
      WHERE lab_requests_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Lab request not found",
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
    console.error("Error fetching lab request:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch lab request",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /api/requests/:id - Update lab request
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      facility_id,
      facility_name,
      patient_id,
      obr_set_id,
      panel_code,
      panel_desc,
      specimen_datetime,
      request_data,
      mappings,
    } = req.body;

    // Check if request exists
    const existingRequest = await query(
      "SELECT lab_requests_id FROM lab_requests WHERE lab_requests_id = $1",
      [id]
    );

    if (existingRequest.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Lab request not found",
        status_code: 404,
        timestamp: new Date().toISOString(),
      });
    }

    // Build UPDATE query dynamically
    const updateFields = [];
    const params = [];
    let paramCount = 0;

    if (facility_id !== undefined) {
      paramCount++;
      updateFields.push(`facility_id = $${paramCount}`);
      params.push(facility_id);
    }

    if (facility_name !== undefined) {
      paramCount++;
      updateFields.push(`facility_name = $${paramCount}`);
      params.push(facility_name);
    }

    if (patient_id !== undefined) {
      paramCount++;
      updateFields.push(`patient_id = $${paramCount}`);
      params.push(patient_id);
    }

    if (obr_set_id !== undefined) {
      paramCount++;
      updateFields.push(`obr_set_id = $${paramCount}`);
      params.push(obr_set_id);
    }

    if (panel_code !== undefined) {
      paramCount++;
      updateFields.push(`panel_code = $${paramCount}`);
      params.push(panel_code);
    }

    if (panel_desc !== undefined) {
      paramCount++;
      updateFields.push(`panel_desc = $${paramCount}`);
      params.push(panel_desc);
    }

    if (specimen_datetime !== undefined) {
      paramCount++;
      updateFields.push(`specimen_datetime = $${paramCount}`);
      params.push(specimen_datetime);
    }

    if (request_data !== undefined) {
      paramCount++;
      updateFields.push(`request_data = $${paramCount}`);
      params.push(request_data);
    }

    if (mappings !== undefined) {
      paramCount++;
      updateFields.push(`mappings = $${paramCount}`);
      params.push(mappings);
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
      `UPDATE lab_requests 
       SET ${updateFields.join(", ")}, updated_at = NOW()
       WHERE lab_requests_id = $${paramCount}
       RETURNING lab_requests_id, request_id, facility_code, updated_at`,
      params
    );

    res.json({
      message: "Lab request updated successfully",
      data: result.rows[0],
      status_code: 200,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating lab request:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to update lab request",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /api/requests/:id - Delete lab request
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if request exists
    const existingRequest = await query(
      "SELECT lab_requests_id FROM lab_requests WHERE lab_requests_id = $1",
      [id]
    );

    if (existingRequest.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Lab request not found",
        status_code: 404,
        timestamp: new Date().toISOString(),
      });
    }

    // Use transaction to delete request and related results
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // Delete related results first
      await client.query("DELETE FROM lab_results WHERE lab_requests_id = $1", [
        id,
      ]);

      // Delete the request
      await client.query(
        "DELETE FROM lab_requests WHERE lab_requests_id = $1",
        [id]
      );

      await client.query("COMMIT");

      res.json({
        message: "Lab request and related results deleted successfully",
        status_code: 200,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error deleting lab request:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to delete lab request",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export { router };
