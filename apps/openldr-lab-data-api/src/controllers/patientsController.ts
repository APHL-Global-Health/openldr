import express from "express";
import { query } from '../services/database';

const router = express.Router();


// POST /api/patients - Create new patient
router.post('/', async (req, res) => {
  try {
    const {
      patient_id,
      facility_code,
      patient_data
    } = req.body;

    // Validate required fields
    if (!patient_id || !facility_code) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'patient_id and facility_code are required',
        status_code: 400,
        timestamp: new Date().toISOString()
      });
    }

    // Check if patient already exists
    const existingPatient = await query(
      'SELECT patients_id, patient_id, facility_code, created_at FROM patients WHERE patient_id = $1 AND facility_code = $2',
      [patient_id, facility_code]
    );

    if (existingPatient.rows.length > 0) {
      // Return existing patient instead of error (idempotent behavior)
      return res.status(200).json({
        message: 'Patient already exists',
        data: existingPatient.rows[0],
        status_code: 200,
        duplicate: true,
        timestamp: new Date().toISOString()
      });
    }

    // Insert new patient
    const result = await query(
      `INSERT INTO patients (patient_id, facility_code, patient_data) 
       VALUES ($1, $2, $3) 
       RETURNING patients_id, patient_id, facility_code, created_at`,
      [patient_id, facility_code, patient_data]
    );

    res.status(201).json({
      message: 'Patient created successfully',
      data: result.rows[0],
      status_code: 201,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create patient',
      status_code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/patients - List patients with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      facility_code,
      patient_id,
      limit = 50,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'DESC'
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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validate sort parameters
    const allowedSortFields = ['created_at', 'patient_id', 'facility_code'];
    const allowedSortOrders = ['ASC', 'DESC'];
    
    const sortByStr = typeof sort_by === 'string' ? sort_by : 'created_at';
    const sortOrderStr = typeof sort_order === 'string' ? sort_order : 'DESC';
    
    const sortField = allowedSortFields.includes(sortByStr) ? sortByStr : 'created_at';
    const sortDirection = allowedSortOrders.includes(sortOrderStr.toUpperCase()) ? sortOrderStr.toUpperCase() : 'DESC';

    // Get total count
    const countResult:any = await query(
      `SELECT COUNT(*) as total FROM patients ${whereClause}`,
      params
    );

    // Get paginated results
    const limitNum = typeof limit === 'string' ? parseInt(limit) : 50;
    const offsetNum = typeof offset === 'string' ? parseInt(offset) : 0;
    const result = await query(
      `SELECT 
        patients_id, patient_id, facility_code, patient_data, created_at, updated_at
      FROM patients 
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
        has_more: result.rows.length === limitNum
      },
      status_code: 200,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch patients',
      status_code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/patients/:id - Get specific patient
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        patients_id, patient_id, facility_code, patient_data, created_at, updated_at
      FROM patients 
      WHERE patients_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
        status_code: 404,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      data: result.rows[0],
      status_code: 200,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch patient',
      status_code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/patients/:id - Update patient
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      patient_data
    } = req.body;

    // Check if patient exists
    const existingPatient = await query(
      'SELECT patients_id FROM patients WHERE patients_id = $1',
      [id]
    );

    if (existingPatient.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
        status_code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // Update patient
    const result = await query(
      `UPDATE patients 
       SET patient_data = $1, updated_at = NOW()
       WHERE patients_id = $2
       RETURNING patients_id, patient_id, facility_code, updated_at`,
      [patient_data, id]
    );

    res.json({
      message: 'Patient updated successfully',
      data: result.rows[0],
      status_code: 200,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update patient',
      status_code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/patients/:id - Delete patient
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if patient exists
    const existingPatient = await query(
      'SELECT patients_id FROM patients WHERE patients_id = $1',
      [id]
    );

    if (existingPatient.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
        status_code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // Check if patient has related requests
    const relatedRequests:any = await query(
      'SELECT COUNT(*) as count FROM lab_requests WHERE patient_id = (SELECT patient_id FROM patients WHERE patients_id = $1)',
      [id]
    );

    if (parseInt(relatedRequests.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Cannot delete patient with existing lab requests',
        status_code: 409,
        timestamp: new Date().toISOString()
      });
    }

    // Delete the patient
    await query(
      'DELETE FROM patients WHERE patients_id = $1',
      [id]
    );

    res.json({
      message: 'Patient deleted successfully',
      status_code: 200,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete patient',
      status_code: 500,
      timestamp: new Date().toISOString()
    });
  }
});


export { router };
