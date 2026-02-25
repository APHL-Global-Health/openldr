// OpenLDR Manual Entry OpenLDRv2 Recipient Plugin
// Plugin to store manual entry lab data in the lab data database
// Follows the same structure as the OpenLDRv2 HL7 plugin but for manual entry format

/**
 * Configuration - hardcoded for security context compatibility
 */
const CONFIG = {
  apiUrl: 'http://openldr-external-database:3009'
};

/**
 * HTTP client for API calls
 */
async function apiCall(endpoint, method = 'GET', data = null) {
  const url = `${CONFIG.apiUrl}${endpoint}`;
  
  try {
    const headers = {
      'User-Agent': 'OpenLDR-Manual-Entry-OpenLDRv2-Plugin/1.0.0'
    };
    
    const response = await http.request(method, url, data ? JSON.stringify(data) : null, headers);
    
    if (response.ok) {
      try {
        const responseData = JSON.parse(response.data);
        return { success: true, data: responseData };
      } catch (e) {
        return { success: true, data: response.data };
      }
    } else {
      // Pass through the full error response
      throw new Error(`HTTP ${response.status}: ${response.data}`);
    }
  } catch (error) {
    throw new Error(`API call failed: ${error.message}`);
  }
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Convert sex to HL7 format
 */
function convertSexToHL7(sex) {
  if (!sex) return 'UNK';
  const sexMap = {
    'male': 'M',
    'female': 'F',
    'm': 'M',
    'f': 'F',
    'Male': 'M',
    'Female': 'F'
  };
  return sexMap[sex.toLowerCase()] || 'UNK';
}

/**
 * Extract patient data for API from manual entry format
 * Only requires: patient_id, facility_code, patient_data (JSONB)
 */
function extractPatient(manualData) {
  // Use facility information from metadata if available, otherwise fall back to manual data
  const facilityCode = manualData._metadata?.facility?.facility_code || 
                      manualData.labFacilityCode || 
                      'MANUAL_ENTRY';
  
  // Calculate age from DOB if provided
  const ageInYears = manualData.dob ? calculateAge(manualData.dob) : null;
  
  return {
    patient_id: manualData.patientId,
    facility_code: facilityCode,
    patient_data: {
      // Store all patient-related data in JSONB using OpenLDRv2 field names
      age_years: ageInYears,
      age_days: null, // Not provided in manual entry format
      sex_code: convertSexToHL7(manualData.sex),
      first_name: manualData.firstName,
      last_name: manualData.lastName,
      date_of_birth: manualData.dob
    }
  };
}

/**
 * Extract lab request data for API from manual entry format
 * Only requires: request_id, facility_code (others are optional)
 */
function extractRequest(manualData) {
  // Use facility information from metadata if available, otherwise fall back to manual data
  const facilityCode = manualData._metadata?.facility?.facility_code || 
                      manualData.labFacilityCode || 
                      'MANUAL_ENTRY';
  const facilityId = manualData._metadata?.facility?.facility_id || null;
  const facilityName = manualData._metadata?.facility?.facility_name || 
                      manualData.labFacilityCode || 
                      'Manual Entry Facility';
  
  return {
    request_id: manualData.requestId,
    facility_code: facilityCode,
    facility_id: facilityId,
    facility_name: facilityName,
    patient_id: manualData.patientId,
    panel_code: manualData.panelCode,
    panel_desc: manualData.panelDescription || manualData.panelCode,
    specimen_datetime: manualData.specimenDate ? new Date(manualData.specimenDate).toISOString() : null,
    obr_set_id: 1, // Default to 1 for manual entry - separate column for database constraint
    request_data: {
      // Store all request-related data in JSONB using OpenLDRv2 field names
      date_time_stamp: null, // Not provided in manual entry format
      version_stamp: null, // Not provided in manual entry format
      lims_date_time_stamp: null, // Not applicable for manual entry
      lims_version_stamp: null, // Not applicable for manual entry
      obr_set_id: 1, // Default to 1 for manual entry - keep in JSONB for reference
      registered_datetime: null, // Not provided in manual entry format
      received_datetime: manualData.specimenDate ? new Date(manualData.specimenDate).toISOString() : null,
      analysis_datetime: null, // Not provided in manual entry format
      authorised_datetime: null, // Not provided in manual entry format
      point_of_care: false, // Manual entry is not point of care
      registered_by: manualData.orderProvider || null,
      tested_by: null,
      authorised_by: null,
      age_in_years: manualData.dob ? calculateAge(manualData.dob) : null,
      age_in_days: null, // Not provided in manual entry format
      rejection_code: null, // No rejection for manual entry
      requesting_lab_code: null,
      testing_lab_code: manualData.labFacilityCode,
      specimen_source_code: null, // Manual entry
      specimen_source_desc: null,
      sex_code: convertSexToHL7(manualData.sex)
    },
    mappings: manualData._mappings || null
  };
}

/**
 * Extract lab result data for API from manual entry format
 * Only requires: lab_requests_id (others are optional)
 */
function extractResult(manualData, labRequestsId) {
  return {
    lab_requests_id: labRequestsId,
    obx_set_id: 1, // Default to 1 for manual entry
    observation_code: manualData.observationCode,
    observation_desc: manualData.observationDescription || manualData.observationCode,
    rpt_result: manualData.results,
    rpt_units: manualData.resultUnits,
    rpt_flag: null, // Not provided in manual entry format, default to null
    result_timestamp: new Date().toISOString(),
    result_data: {
      // Store all result-related data in JSONB using OpenLDRv2 field names
      date_time_stamp: null, // Not provided in manual entry format
      version_stamp: null, // Not provided in manual entry format
      lims_date_time_stamp: null, // Not applicable for manual entry
      lims_version_stamp: null, // Not applicable for manual entry
      request_id: manualData.requestId,
      obr_set_id: 1, // Default to 1 for manual entry
      obx_sub_id: 1, // Default to 1 for manual entry
      coded_value: null, // Not provided in manual entry format
      reference_range: manualData.referenceRange,
      interpretation: manualData.interpretation
    }
  };
}

/**
 * Main processing function for manual entry data
 * @param {Object} messageContent - The manual entry data with metadata
 * @returns {Object} - Processing result with record IDs
 */
async function process(messageContent) {
  const result = {
    success: true,
    processed: { patients: 0, requests: 0, results: 0 },
    errors: [],
    record_ids: {
      patients: [],
      requests: [],
      results: []
    }
  };

  try {
    let labRequestsId = null;

    // Store patient if we have patient ID
    if (messageContent.patientId) {
      const patientData = extractPatient(messageContent);
      const patientResponse = await apiCall('/api/v1/patients', 'POST', patientData);
      if (patientResponse.success && patientResponse.data && patientResponse.data.data) {
        result.record_ids.patients.push(patientResponse.data.data.patients_id);
      }
      result.processed.patients++;
    }

    // Store request if we have request ID
    if (messageContent.requestId) {
      const requestData = extractRequest(messageContent);
      const requestResponse = await apiCall('/api/v1/requests', 'POST', requestData);
      if (requestResponse.success && requestResponse.data && requestResponse.data.data) {
        result.record_ids.requests.push(requestResponse.data.data.lab_requests_id);
        labRequestsId = requestResponse.data.data.lab_requests_id;
      }
      result.processed.requests++;
    }

    // Store result if we have results and a lab_requests_id
    if (messageContent.results && labRequestsId) {
      const resultData = extractResult(messageContent, labRequestsId);
      const resultResponse = await apiCall('/api/v1/results', 'POST', resultData);
      if (resultResponse.success && resultResponse.data && resultResponse.data.data) {
        result.record_ids.results.push(resultResponse.data.data.lab_results_id);
      }
      result.processed.results++;
    } else if (messageContent.results && !labRequestsId) {
      result.errors.push('Cannot store results: lab_requests_id not available');
    }

    // Add processing completion timestamp
    result.processing_completed = new Date().toISOString();

  } catch (error) {
    result.success = false;
    result.errors.push(error.message);
    result.processing_completed = new Date().toISOString();
  }

  // Return the result object - this will be merged with metadata by the external storage service
  return result;
}

module.exports = { process }; 