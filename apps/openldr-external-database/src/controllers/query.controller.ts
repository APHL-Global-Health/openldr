import express from "express";
import { query } from "../services/database.service";

const router = express.Router();

// GET /api/query/summary - Get facility summary statistics
router.get("/summary", async (req, res) => {
  try {
    const { facility_code } = req.query;

    let whereClause = "";
    let params = [];

    if (facility_code) {
      whereClause = "WHERE facility_code = $1";
      params.push(facility_code);
    }

    const result = await query(
      `SELECT * FROM lab_data_summary ${whereClause}`,
      params,
    );

    res.json({
      data: result.rows,
      status_code: 200,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch summary statistics",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/query/requests - Query lab requests with advanced filters
router.get("/requests", async (req, res) => {
  try {
    const {
      facility_code,
      patient_id,
      panel_code,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
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

    if (date_from) {
      paramCount++;
      whereConditions.push(`specimen_datetime >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereConditions.push(`specimen_datetime <= $${paramCount}`);
      params.push(date_to);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Get total count
    const countResult: any = await query(
      `SELECT COUNT(*) as total FROM lab_requests ${whereClause}`,
      params,
    );

    // Get paginated results
    const limitNum = typeof limit === "string" ? parseInt(limit) : 50;
    const offsetNum = typeof offset === "string" ? parseInt(offset) : 0;
    const result: any = await query(
      `SELECT 
        lab_requests_id, request_id, facility_code, facility_name,
        patient_id, obr_set_id, panel_code, panel_desc, specimen_datetime,
        status, created_at
      FROM lab_requests 
      ${whereClause}
      ORDER BY specimen_datetime DESC
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
    console.error("Error querying requests:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to query requests",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/query/results - Query lab results with advanced filters
router.get("/results", async (req, res) => {
  try {
    const {
      facility_code,
      observation_code,
      rpt_flag,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = req.query;

    // Build WHERE clause
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (facility_code) {
      paramCount++;
      whereConditions.push(`lr.facility_code = $${paramCount}`);
      params.push(facility_code);
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

    if (date_from) {
      paramCount++;
      whereConditions.push(`lres.result_timestamp >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereConditions.push(`lres.result_timestamp <= $${paramCount}`);
      params.push(date_to);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Get total count
    const countResult: any = await query(
      `SELECT COUNT(*) as total 
       FROM lab_results lres
       JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
       ${whereClause}`,
      params,
    );

    // Get paginated results
    const limitNum = typeof limit === "string" ? parseInt(limit) : 50;
    const offsetNum = typeof offset === "string" ? parseInt(offset) : 0;
    const result: any = await query(
      `SELECT 
        lres.lab_results_id, lres.observation_code, lres.observation_desc,
        lres.rpt_result, lres.rpt_units, lres.rpt_flag, lres.result_timestamp,
        lr.request_id, lr.facility_code, lr.panel_code, lr.patient_id
      FROM lab_results lres
      JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
      ${whereClause}
      ORDER BY lres.result_timestamp DESC
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
    console.error("Error querying results:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to query results",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/query/abnormal - Get abnormal results
router.get("/abnormal", async (req, res) => {
  try {
    const {
      facility_code,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = req.query;

    // Build WHERE clause
    let whereConditions = ["lres.rpt_flag IN ('H', 'L', 'A', 'R')"];
    let params = [];
    let paramCount = 0;

    if (facility_code) {
      paramCount++;
      whereConditions.push(`lr.facility_code = $${paramCount}`);
      params.push(facility_code);
    }

    if (date_from) {
      paramCount++;
      whereConditions.push(`lres.result_timestamp >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereConditions.push(`lres.result_timestamp <= $${paramCount}`);
      params.push(date_to);
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    // Get total count
    const countResult: any = await query(
      `SELECT COUNT(*) as total 
       FROM lab_results lres
       JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
       ${whereClause}`,
      params,
    );

    // Get paginated results
    const limitNum = typeof limit === "string" ? parseInt(limit) : 50;
    const offsetNum = typeof offset === "string" ? parseInt(offset) : 0;
    const result: any = await query(
      `SELECT 
        lres.lab_results_id, lres.observation_code, lres.observation_desc,
        lres.rpt_result, lres.rpt_units, lres.rpt_flag, lres.result_timestamp,
        lr.request_id, lr.facility_code, lr.panel_code, lr.patient_id
      FROM lab_results lres
      JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
      ${whereClause}
      ORDER BY lres.result_timestamp DESC
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
    console.error("Error querying abnormal results:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to query abnormal results",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/query/ocm - Query by OCL mappings
router.get("/ocm", async (req, res) => {
  try {
    const {
      concept_code,
      to_concept_code,
      to_source_name,
      limit = 50,
      offset = 0,
    } = req.query;

    if (!concept_code && !to_concept_code && !to_source_name) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "At least one mapping parameter is required (concept_code, to_concept_code, or to_source_name)",
        status_code: 400,
        timestamp: new Date().toISOString(),
      });
    }

    // Build JSONB query conditions
    let jsonbConditions = [];
    let params = [];
    let paramCount = 0;
    const concept_codeStr =
      typeof concept_code === "string" ? concept_code : "";

    if (concept_code) {
      paramCount++;
      jsonbConditions.push(`mappings ? $${paramCount}`);
      params.push(concept_code);
    }

    if (to_concept_code) {
      paramCount++;
      jsonbConditions.push(`mappings @> $${paramCount}`);
      params.push(
        JSON.stringify({
          [concept_codeStr]: { mappings: [{ toConceptCode: to_concept_code }] },
        }),
      );
    }

    if (to_source_name) {
      paramCount++;
      jsonbConditions.push(`mappings @> $${paramCount}`);
      params.push(
        JSON.stringify({
          [concept_codeStr]: { mappings: [{ toSourceName: to_source_name }] },
        }),
      );
    }

    const whereClause = `WHERE ${jsonbConditions.join(" AND ")}`;

    // Get total count
    const countResult: any = await query(
      `SELECT COUNT(*) as total FROM lab_requests ${whereClause}`,
      params,
    );

    // Get paginated results
    const limitNum = typeof limit === "string" ? parseInt(limit) : 50;
    const offsetNum = typeof offset === "string" ? parseInt(offset) : 0;
    const result: any = await query(
      `SELECT 
        lab_requests_id, request_id, facility_code, facility_name,
        patient_id, obr_set_id, panel_code, panel_desc, specimen_datetime,
        mappings, status, created_at
      FROM lab_requests 
      ${whereClause}
      ORDER BY specimen_datetime DESC
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
    console.error("Error querying OCL mappings:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to query OCL mappings",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

//====================================================================================
// GET /api/query/trends - Get trends over time
router.get("/trends", async (req, res) => {
  try {
    const {
      facility_code,
      panel_code,
      observation_code,
      date_from,
      date_to,
      group_by = "day", // day, week, month
    } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({
        error: "Bad Request",
        message: "date_from and date_to are required for trends analysis",
        status_code: 400,
        timestamp: new Date().toISOString(),
      });
    }

    // Build WHERE clause
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (facility_code) {
      paramCount++;
      whereConditions.push(`lr.facility_code = $${paramCount}`);
      params.push(facility_code);
    }

    if (panel_code) {
      paramCount++;
      whereConditions.push(`lr.panel_code = $${paramCount}`);
      params.push(panel_code);
    }

    if (observation_code) {
      paramCount++;
      whereConditions.push(`lres.observation_code = $${paramCount}`);
      params.push(observation_code);
    }

    paramCount++;
    whereConditions.push(`lres.result_timestamp >= $${paramCount}`);
    params.push(date_from);

    paramCount++;
    whereConditions.push(`lres.result_timestamp <= $${paramCount}`);
    params.push(date_to);

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    // Determine date grouping
    let dateGroup;
    switch (group_by) {
      case "week":
        dateGroup = `DATE_TRUNC('week', lres.result_timestamp)`;
        break;
      case "month":
        dateGroup = `DATE_TRUNC('month', lres.result_timestamp)`;
        break;
      default:
        dateGroup = `DATE_TRUNC('day', lres.result_timestamp)`;
    }

    const result = await query(
      `SELECT 
        ${dateGroup} as period,
        COUNT(*) as total_results,
        COUNT(CASE WHEN lres.rpt_flag IN ('H', 'L', 'A', 'R') THEN 1 END) as abnormal_results,
        COUNT(CASE WHEN lres.rpt_flag = 'H' THEN 1 END) as high_results,
        COUNT(CASE WHEN lres.rpt_flag = 'L' THEN 1 END) as low_results
      FROM lab_results lres
      JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
      ${whereClause}
      GROUP BY ${dateGroup}
      ORDER BY period ASC`,
      params,
    );

    res.json({
      data: result.rows,
      metadata: {
        facility_code,
        panel_code,
        observation_code,
        date_from,
        date_to,
        group_by,
      },
      status_code: 200,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching trends:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch trends",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/query/patient-history - Get complete patient history
router.get("/patient-history", async (req, res) => {
  try {
    const {
      patient_id,
      facility_code,
      date_from,
      date_to,
      limit = 100,
      offset = 0,
    } = req.query;

    if (!patient_id || !facility_code) {
      return res.status(400).json({
        error: "Bad Request",
        message: "patient_id and facility_code are required",
        status_code: 400,
        timestamp: new Date().toISOString(),
      });
    }

    // Build WHERE clause
    let whereConditions = ["lr.patient_id = $1", "lr.facility_code = $2"];
    let params = [patient_id, facility_code];
    let paramCount = 2;

    if (date_from) {
      paramCount++;
      whereConditions.push(`lres.result_timestamp >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereConditions.push(`lres.result_timestamp <= $${paramCount}`);
      params.push(date_to);
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    // Get total count
    const countResult: any = await query(
      `SELECT COUNT(*) as total 
       FROM lab_results lres
       JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
       ${whereClause}`,
      params,
    );

    // Get patient history with all details
    const limitNum = typeof limit === "string" ? parseInt(limit) : 50;
    const offsetNum = typeof offset === "string" ? parseInt(offset) : 0;
    const result: any = await query(
      `SELECT 
        lr.request_id,
        lr.panel_code,
        lr.panel_desc,
        lr.specimen_datetime,
        lres.obx_set_id,
        lres.observation_code,
        lres.observation_desc,
        lres.rpt_result,
        lres.rpt_units,
        lres.rpt_flag,
        lres.result_timestamp,
        lres.result_data,
        lr.request_data
      FROM lab_results lres
      JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
      ${whereClause}
      ORDER BY lres.result_timestamp DESC
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
      patient_info: {
        patient_id,
        facility_code,
      },
      status_code: 200,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching patient history:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch patient history",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/query/facility-comparison - Compare facilities
router.get("/facility-comparison", async (req, res) => {
  try {
    const { facility_codes, panel_code, date_from, date_to } = req.query;

    const _facility_codes =
      typeof facility_codes === "string" ? facility_codes : "";

    if (!facility_codes) {
      return res.status(400).json({
        error: "Bad Request",
        message: "facility_codes parameter is required (comma-separated)",
        status_code: 400,
        timestamp: new Date().toISOString(),
      });
    }

    const facilityList = _facility_codes.split(",").map((f) => f.trim());

    // Build WHERE clause
    let whereConditions = [`lr.facility_code = ANY($1)`];
    let params: any = [facilityList];
    let paramCount = 1;

    if (panel_code) {
      paramCount++;
      whereConditions.push(`lr.panel_code = $${paramCount}`);
      params.push(panel_code);
    }

    if (date_from) {
      paramCount++;
      whereConditions.push(`lres.result_timestamp >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereConditions.push(`lres.result_timestamp <= $${paramCount}`);
      params.push(date_to);
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    const result = await query(
      `SELECT 
        lr.facility_code,
        lr.facility_name,
        COUNT(DISTINCT lr.request_id) as total_requests,
        COUNT(DISTINCT lr.patient_id) as unique_patients,
        COUNT(lres.lab_results_id) as total_results,
        COUNT(CASE WHEN lres.rpt_flag IN ('H', 'L', 'A', 'R') THEN 1 END) as abnormal_results,
        ROUND(
          COUNT(CASE WHEN lres.rpt_flag IN ('H', 'L', 'A', 'R') THEN 1 END) * 100.0 / COUNT(lres.lab_results_id), 
          2
        ) as abnormal_percentage
      FROM lab_results lres
      JOIN lab_requests lr ON lres.lab_requests_id = lr.lab_requests_id
      ${whereClause}
      GROUP BY lr.facility_code, lr.facility_name
      ORDER BY total_requests DESC`,
      params,
    );

    res.json({
      data: result.rows,
      metadata: {
        facility_codes: facilityList,
        panel_code,
        date_from,
        date_to,
      },
      status_code: 200,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching facility comparison:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch facility comparison",
      status_code: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
