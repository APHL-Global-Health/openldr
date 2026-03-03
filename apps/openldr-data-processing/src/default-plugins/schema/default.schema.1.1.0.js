const SYSTEMS = {
  FACILITY: 'WHONET_FACILITY',
  TEST: 'WHONET_TEST',
  SPECIMEN: 'WHONET_SPEC',
  ORG: 'WHONET_ORG',
  ABX: 'WHONET_ABX',
};

function validate(message) {
  return Boolean(
    message &&
      typeof message === 'object' &&
      message.Facility &&
      typeof message.Facility.Code === 'string' &&
      message.Facility.Code.trim() &&
      typeof message.LabNumber === 'string' &&
      Array.isArray(message.TestOrders) &&
      Array.isArray(message.TestResults),
  );
}

function asConcept(system_id, concept_code, display_name, concept_class, datatype, properties) {
  if (!concept_code) {
    return null;
  }
  return {
    system_id,
    concept_code: String(concept_code),
    display_name: display_name ? String(display_name) : String(concept_code),
    concept_class,
    datatype,
    properties: properties || {},
  };
}

function convert(message) {
  if (!message.Facility || !message.Facility.Code) {
    throw new Error('Facility.Code is required');
  }

  const firstOrder = Array.isArray(message.TestOrders) && message.TestOrders.length > 0
    ? message.TestOrders[0]
    : null;

  const patient = {
    patient_guid: message.LabNumber,
    firstname: message.FirstName || null,
    middlename: message.MiddleName || null,
    surname: message.LastName || null,
    sex: message.Sex || 'U',
    folder_no: message.FolderNo || null,
    address: message.Address || null,
    patient_data: {
      source_lab_number: message.LabNumber,
      source_inner_lab_number: message.InnerLabNumber || null,
      source_reference_number: message.ReferenceNumber || null,
      raw: message,
    },
  };

  const facilityProps = {
    Region: message.Facility.Region || null,
    District: message.Facility.District || null,
    PostalAddress: message.Facility.PostalAddress || null,
    Street: message.Facility.Street || null,
    FacilityName: message.Facility.FacilityName || null,
  };

  const lab_request = {
    request_id: message.LabNumber,
    facility_code: asConcept(
      SYSTEMS.FACILITY,
      message.Facility.Code,
      message.Facility.FacilityName || message.Facility.Code,
      'facility',
      'coded',
      facilityProps,
    ),
    panel_code: asConcept(
      SYSTEMS.TEST,
      firstOrder && firstOrder.CODE,
      (firstOrder && (firstOrder.DESCRIPTION || firstOrder._DESCRIPTION)) || (firstOrder && firstOrder.CODE),
      'panel',
      'coded',
    ),
    specimen_code: asConcept(
      SYSTEMS.SPECIMEN,
      message.Specimen,
      message.Specimen,
      'specimen',
      'coded',
    ),
    clinical_diagnosis: message.ClinicalDiagnosis || null,
    taken_datetime: message.TakenDateTime || null,
    collected_datetime: message.CollectedDateTime || null,
    received_in_lab_datetime: message.ReceivedInLabDateTime || null,
    priority: message.Priority || null,
    source_payload: {
      order_count: Array.isArray(message.TestOrders) ? message.TestOrders.length : 0,
      result_count: Array.isArray(message.TestResults) ? message.TestResults.length : 0,
    },
  };

  const lab_results = [];
  const isolates = [];
  const susceptibility_tests = [];
  let currentIsolateIndex = 0;

  for (const testResult of message.TestResults || []) {
    const entries = (testResult && testResult.ORDER && Array.isArray(testResult.ORDER.ORDERS))
      ? testResult.ORDER.ORDERS
      : [];

    for (const entry of entries) {
      if (!entry || !entry.Code) {
        continue;
      }

      if (entry.Code === 'ORGS' && entry.Value) {
        currentIsolateIndex += 1;
        isolates.push({
          isolate_index: currentIsolateIndex,
          organism_code: asConcept(
            SYSTEMS.ORG,
            entry.Value,
            entry.Value,
            'organism',
            'coded',
          ),
          source_observation_code: asConcept(
            SYSTEMS.TEST,
            entry.Code,
            entry.Description || entry.Code,
            'test',
            'coded',
          ),
          raw_result: entry,
        });
        continue;
      }

      if (entry.ResultType === 4) {
        if (currentIsolateIndex === 0) {
          throw new Error('Susceptibility result encountered before any organism identification');
        }
        susceptibility_tests.push({
          isolate_index: currentIsolateIndex,
          antibiotic_code: asConcept(
            SYSTEMS.ABX,
            entry.Code,
            entry.Description || entry.Code,
            'antibiotic',
            'coded',
          ),
          susceptibility_value: entry.Value || null,
          raw_result: entry,
        });
        continue;
      }

      lab_results.push({
        observation_code: asConcept(
          SYSTEMS.TEST,
          entry.Code,
          entry.Description || entry.Code,
          'test',
          entry.ResultType === 3 ? 'coded' : 'text',
        ),
        result_value: entry.Value || null,
        result_type: entry.ResultType || null,
        is_resulted: Boolean(entry.IsResulted),
        raw_result: entry,
      });
    }
  }

  return {
    patient,
    lab_request,
    lab_results,
    isolates,
    susceptibility_tests,
    _plugin: {
      plugin_name: 'default-schema',
      plugin_version: '1.1.0',
      source_system: 'DISA*Lab-like JSON',
    },
  };
}

module.exports = {
  name: 'default-schema',
  version: '1.1.0',
  status: 'deprecated',
  validate,
  convert,
};
