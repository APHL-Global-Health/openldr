// OpenLDR FakeLis Data Recipient Plugin
// Plugin to store FakeLis' lab data in the lab data database
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
      'User-Agent': 'OpenLDR-FakeLis-Plugin/1.0.0'
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

function calculateAgeInYears(dob) {
  if (!dob) return null;

  // dob format: dd/MM/yyyy
  // const [day, month, year] = dob.split('/').map(Number);
  // const birthDate = new Date(year, month - 1, day);
  const birthDate = new Date(dob);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  return age;
}

function calculateAgeInDays(dateStr) {
  // const [day, month, year] = dateStr.split('/').map(Number);

  // const birthUTC = Date.UTC(year, month - 1, day);
  const birthDate = new Date(dateStr);
  const birthUTC = Date.UTC(
    birthDate.getUTCFullYear(),
    birthDate.getUTCMonth(),
    birthDate.getUTCDate()
  );

  const todayUTC = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  );

  return Math.floor((todayUTC - birthUTC) / (1000 * 60 * 60 * 24));
}

/**
 * Main processing function for manual entry data
 * @param {Object} messageContent - The manual entry data with metadata
 * @returns {Object} - Processing result with record IDs
 */
async function process(messageContent) {
  const response = {
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
    const content = (messageContent || []);
    const items = Array.isArray(content) ? content : [content];

    for(let xx=0; xx<items.length; xx++){
      const item = items[xx];
      const orders = (item.TestOrders || []);
      const results = (item.TestResults || []);

      if(item){
        const patient = {
            facility_code: item?.Facility?.Code || null,
            patient_id: item.FolderNo,
            patient_data: {
                age_in_years: item.DobAge ? calculateAgeInYears(item.DobAge) : null,
                age_in_days: item.DobAge ? calculateAgeInDays(item.DobAge) : null,
                sex_code: item.Sex || null,
                date_of_birth: item.DobAge || null, 
                first_name: item.FirstName,
                last_name: item.LastName,                
            },
        };

        const patientResponse = await apiCall('/api/patients', 'POST', patient);
        if (patientResponse.success && patientResponse.data && patientResponse.data.data) {
          response.record_ids.patients.push(patientResponse.data.data.patients_id);
        }
        response.processed.patients++;
        

       
        for(let z=0; z<orders.length; z++){
          const order = orders[z];
          const result = results.find(res => res.TESTCODE === order.CODE);
          const tests = result.ORDER.ORDERS.filter((order) => order.IsResulted);

          

          const requestData = {
            request_id: item.LabNumber,
            facility_code: item?.Facility?.Code || null,
            // facility_id: facilityId,
            facility_name: item?.Facility?.FacilityName || null,
            patient_id: item.FolderNo,
            panel_code: order.CODE,
            panel_desc: order.DESCRIPTION,
            // specimen_datetime: manualData.specimenDate ? new Date(manualData.specimenDate).toISOString() : null,
            obr_set_id: z + 1, // Default to 1 for manual entry - separate column for database constraint
            request_data: {
                // Store all request-related data in JSONB using OpenLDRv2 field names
                date_time_stamp: new Date().toISOString(), // Not provided in manual entry format
                version_stamp: "1.0.0", // Not provided in manual entry format
                lims_date_time_stamp: result?.DATESTAMP || null, // Not applicable for manual entry
                lims_version_stamp: null, // Not applicable for manual entry
                obr_set_id: z + 1, // Default to 1 for manual entry - keep in JSONB for reference
                
                specimen_datetime: item.TakenDateTime || null,
                registered_datetime: item.RegisteredDatetime || null,
                received_datetime: item.ReceivedInLabDateTime || null,
                analysis_datetime: result?.DATESTAMP || null,
                authorised_datetime: null,

                point_of_care: item.WardClinic || item?.Facility?.FacilityName || null,
                registered_by: null,
                tested_by: null,
                authorised_by: null,

                age_in_years: item.DobAge ? calculateAgeInYears(item.DobAge) : null,
                age_in_days: item.DobAge ? calculateAgeInDays(item.DobAge) : null,

                rejection_code: null, 
                requesting_lab_code: item?.Facility?.Code ? `FAKE${item?.Facility?.Code}` : null,
                testing_lab_code: item.LabNumber.substring(0,3) || null,

                specimen_source_code: item.Specimen || null, // Manual entry
                specimen_source_desc: item.SpecimenInfo || null,
                sex_code: item.Sex || null,

                priority_code: item.Priority || null,
                },
            mappings:  null            
          };

          const requestResponse = await apiCall('/api/requests', 'POST', requestData);
          if (requestResponse.success && requestResponse.data && requestResponse.data.data) {
            response.record_ids.requests.push(requestResponse.data.data.lab_requests_id);
                        
            for(let y=0; y<tests.length; y++){
              const test = tests[y];
              
              const resultData = {
                    lab_requests_id: requestResponse.data.data.lab_requests_id,
                    obx_set_id: y+1, // Default to 1 for manual entry
                    observation_code: test.Code,
                    observation_desc: test.Description,
                    rpt_result: test.Value,
                    rpt_units: null,
                    rpt_flag: null, // Not provided in manual entry format, default to null
                    result_timestamp: new Date().toISOString(),
                    result_data: {
                        // Store all result-related data in JSONB using OpenLDRv2 field names
                        date_time_stamp: result.DATESTAMP, // Not provided in manual entry format
                        version_stamp: null, // Not provided in manual entry format
                        lims_date_time_stamp: null, // Not applicable for manual entry
                        lims_version_stamp: null, // Not applicable for manual entry
                        request_id: item.LabNumber,
                        obr_set_id: result.TESTINDEX, // Default to 1 for manual entry
                        obx_sub_id: 1, // Default to 1 for manual entry
                        coded_value: null, // Not provided in manual entry format
                        reference_range: null,
                        interpretation: null
                    }      
              };

              const resultResponse = await apiCall('/api/results', 'POST', resultData);
              if (resultResponse.success && resultResponse.data && resultResponse.data.data) {
                response.record_ids.results.push(resultResponse.data.data.lab_results_id);
              }
              response.processed.results++;
            }
          }
          response.processed.requests++;
        }
      }
    }

    // Add processing completion timestamp
    response.processing_completed = new Date().toISOString();
  } catch (error) {
    console.error(error);
    response.success = false;
    response.errors.push(error.message);
    response.processing_completed = new Date().toISOString();
  }


// Return the result object - this will be merged with metadata by the external storage service
  return response;
}

module.exports = { process }; 