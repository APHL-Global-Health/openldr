// OpenLDR Enhanced HL7 Lab Data Recipient Plugin
// Plugin to store enhanced HL7 lab data in the lab data database
// Handles multiple results and stores rich data in JSONB fields

/**
 * Configuration - hardcoded for security context compatibility
 */
const CONFIG = {
  apiUrl: 'http://openldr-lab-data-api:3009'
};

/**
 * HTTP client for API calls
 */
async function apiCall(endpoint, method = 'GET', data = null) {
  const url = `${CONFIG.apiUrl}${endpoint}`;
  
  try {
    const headers = {
      'User-Agent': 'OpenLDR-Enhanced-HL7-Plugin/1.0.0'
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
 * Extract patient data for API from enhanced HL7 format
 * Only requires: patient_id, facility_code, patient_data (JSONB)
 */
function extractPatient(hl7Data) {
  // Use facility information from metadata if available, otherwise fall back to request data
  const facilityCode = hl7Data._metadata?.facility?.facility_code || 
                      hl7Data.requests?.RequestingLabCode || 
                      hl7Data.requests?.TestingLabCode || 
                      'UNKNOWN';
  
  return {
    patient_id: hl7Data.requests?.RequestID || hl7Data.labresults?.[0]?.RequestID,
    facility_code: facilityCode,
    patient_data: {
      // Store all patient-related data in JSONB using OpenLDRv2 field names
      age_years: hl7Data.requests?.AgeInYears,
      age_days: hl7Data.requests?.AgeInDays,
      sex_code: hl7Data.requests?.SexCode
    }
  };
}

/**
 * Extract lab request data for API from enhanced HL7 format
 * Only requires: request_id, facility_code (others are optional)
 */
function extractRequest(hl7Data) {
  const requestData = hl7Data.requests;
  if (!requestData) {
    throw new Error('No request data found in HL7 message');
  }

  // Use facility information from metadata if available, otherwise fall back to request data
  const facilityCode = hl7Data._metadata?.facility?.facility_code || 
                      requestData.RequestingLabCode || 
                      requestData.TestingLabCode || 
                      'UNKNOWN';
  const facilityId = hl7Data._metadata?.facility?.facility_id || null;
  const facilityName = hl7Data._metadata?.facility?.facility_name || 
                      requestData.RequestingLabCode || 
                      requestData.TestingLabCode;
  
  return {
    request_id: requestData.RequestID,
    facility_code: facilityCode,
    facility_id: facilityId,
    facility_name: facilityName,
    patient_id: requestData.RequestID, // Use RequestID as patient_id for HL7
    panel_code: requestData.PanelCode,
    panel_desc: requestData.PanelDesc,
    specimen_datetime: requestData.SpecimenDateTime,
    obr_set_id: requestData.OBRSetID, // Extract as separate column for database constraint
    request_data: {
      // Store all request-related data in JSONB using OpenLDRv2 field names
      date_time_stamp: requestData.DateTimeStamp,
      version_stamp: requestData.Versionstamp,
      lims_date_time_stamp: requestData.LIMSDateTimeStamp,
      lims_version_stamp: requestData.LIMSVersionstamp,
      obr_set_id: requestData.OBRSetID, // Keep in JSONB for reference
      registered_datetime: requestData.RegisteredDateTime,
      received_datetime: requestData.ReceivedDateTime,
      analysis_datetime: requestData.AnalysisDateTime,
      authorised_datetime: requestData.AuthorisedDateTime,
      point_of_care: requestData.PointOfCare,
      registered_by: requestData.RegisteredBy,
      tested_by: requestData.TestedBy,
      authorised_by: requestData.AuthorisedBy,
      age_in_years: requestData.AgeInYears,
      age_in_days: requestData.AgeInDays,
      rejection_code: requestData.RejectionCode,
      requesting_lab_code: requestData.RequestingLabCode,
      testing_lab_code: requestData.TestingLabCode,
      specimen_source_code: requestData.SpecimenSourceCode,
      specimen_source_desc: requestData.SpecimenSourceDesc,
      sex_code: requestData.SexCode
    },
    mappings: hl7Data._mappings || null
  };
}

/**
 * Extract lab result data for API from enhanced HL7 format
 * Only requires: lab_requests_id (others are optional)
 */
function extractResult(resultData, labRequestsId) {
  return {
    lab_requests_id: labRequestsId,
    obx_set_id: resultData.OBXSetID,
    observation_code: resultData.ObservationCode,
    observation_desc: resultData.ObservationDesc,
    rpt_result: resultData.RptResult,
    rpt_units: resultData.RptUnits,
    rpt_flag: null, // Not in OpenLDRv2 schema, default to null
    result_timestamp: resultData.DateTimeStamp || new Date().toISOString(),
    result_data: {
      // Store all result-related data in JSONB using OpenLDRv2 field names
      date_time_stamp: resultData.DateTimeStamp,
      version_stamp: resultData.Versionstamp,
      lims_date_time_stamp: resultData.LIMSDateTimeStamp,
      lims_version_stamp: resultData.LIMSVersionStamp,
      request_id: resultData.RequestID,
      obr_set_id: resultData.OBRSetID,
      obx_sub_id: resultData.OBXSubID,
      coded_value: resultData.CodedValue
    }
  };
}

/**
 * Main processing function for enhanced HL7 data
 * @param {Object} messageContent - The enhanced HL7 data with metadata
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

    // Store patient if we have request data
    if (messageContent.requests?.RequestID) {
      const patientData = extractPatient(messageContent);
      const patientResponse = await apiCall('/api/patients', 'POST', patientData);
      if (patientResponse.success && patientResponse.data && patientResponse.data.data) {
        result.record_ids.patients.push(patientResponse.data.data.patients_id);
      }
      result.processed.patients++;
    }

    // Store request if we have request data
    if (messageContent.requests?.RequestID) {
      const requestData = extractRequest(messageContent);
      const requestResponse = await apiCall('/api/requests', 'POST', requestData);
      if (requestResponse.success && requestResponse.data && requestResponse.data.data) {
        result.record_ids.requests.push(requestResponse.data.data.lab_requests_id);
        labRequestsId = requestResponse.data.data.lab_requests_id;
      }
      result.processed.requests++;
    }

    // Store results if they exist and we have a lab_requests_id
    if (messageContent.labresults && Array.isArray(messageContent.labresults) && labRequestsId) {
      for (const resultItem of messageContent.labresults) {
        const resultData = extractResult(resultItem, labRequestsId);
        const resultResponse = await apiCall('/api/results', 'POST', resultData);
        if (resultResponse.success && resultResponse.data && resultResponse.data.data) {
          result.record_ids.results.push(resultResponse.data.data.lab_results_id);
        }
        result.processed.results++;
      }
    } else if (messageContent.labresults && Array.isArray(messageContent.labresults) && !labRequestsId) {
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