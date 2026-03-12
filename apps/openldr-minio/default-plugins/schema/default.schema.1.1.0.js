const SYSTEMS = {
  FACILITY: 'DEFAULT_FACILITY',
  TEST: 'DEFAULT_TEST',
  SPECIMEN: 'DEFAULT_SPEC',
  ORG: 'DEFAULT_ORG',
  ABX: 'DEFAULT_ABX',
};

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}
function normalizeCode(value) {
  const text = normalizeText(value);
  return text ? text.toUpperCase() : null;
}
function sanitizeDisplayName(displayName, conceptCode) {
  const cleaned = normalizeText(displayName);
  if (!cleaned) return String(conceptCode);
  const suspicious = new Set(['arks', 'ment', 'ts', 'us Threads']);
  if (suspicious.has(cleaned)) return String(conceptCode);
  if (/^[^A-Za-z0-9]*$/.test(cleaned)) return String(conceptCode);
  return cleaned;
}
function asConcept(system_id, concept_code, display_name, concept_class, datatype, properties) {
  const normalizedCode = normalizeCode(concept_code);
  if (!normalizedCode) return null;
  return { system_id, concept_code: normalizedCode, display_name: sanitizeDisplayName(display_name, normalizedCode), concept_class, datatype, properties: properties || {} };
}
function validate(message) {
  const errors = [];
  if (!message || typeof message !== 'object') errors.push('Message must be an object');
  if (!message?.Facility) errors.push('Facility object is required');
  if (!message?.Facility?.Code) errors.push('Facility.Code is required');
  if (!message?.LabNumber) errors.push('LabNumber is required');
  if (!Array.isArray(message?.TestOrders)) errors.push('TestOrders must be an array');
  if (!Array.isArray(message?.TestResults)) errors.push('TestResults must be an array');
  return {
    valid: errors.length === 0,
    reason: errors.length === 0 ? null : 'DISA*Lab-like schema validation failed',
    details: errors.length === 0 ? {} : { errors },
  };
}
function shouldSkipStructuralEntry(entry) {
  const code = normalizeCode(entry && entry.Code);
  const description = normalizeText(entry && entry.Description);
  const value = normalizeText(entry && entry.Value);
  const resultType = Number(entry && entry.ResultType);
  if (!code) return true;
  if (resultType === 9 || Number(entry && entry.Type) === 9) return true;
  if (code === 'LINE0') return true;
  if (!value && !entry?.IsResulted) {
    if (code === 'SCULT' || code === 'GRAMS' || code === 'MZNS' || code === 'WETP') return true;
    if (!description) return true;
  }
  return false;
}
function convert(message) {
  const firstOrder = Array.isArray(message.TestOrders) && message.TestOrders.length > 0 ? message.TestOrders[0] : null;
  const patient = {
    patient_guid: message.LabNumber,
    firstname: normalizeText(message.FirstName),
    middlename: normalizeText(message.MiddleName),
    surname: normalizeText(message.LastName),
    sex: normalizeText(message.Sex) || 'U',
    folder_no: normalizeText(message.FolderNo),
    address: normalizeText(message.Address),
    patient_data: {
      source_lab_number: message.LabNumber,
      source_inner_lab_number: normalizeText(message.InnerLabNumber),
      source_reference_number: normalizeText(message.ReferenceNumber),
      raw: message,
    },
  };
  const facilityProps = {
    Region: normalizeText(message.Facility.Region),
    FacilityType: normalizeText(message.Facility.District),
    PostalAddress: normalizeText(message.Facility.PostalAddress),
    Street: normalizeText(message.Facility.Street),
    FacilityName: normalizeText(message.Facility.FacilityName),
  };
  const requestId = message.LabNumber;
  const lab_request = {
    request_id: requestId,
    facility_code: asConcept(SYSTEMS.FACILITY, message.Facility.Code, message.Facility.FacilityName || message.Facility.Code, 'facility', 'coded', facilityProps),
    panel_code: asConcept(SYSTEMS.TEST, firstOrder && firstOrder.CODE, (firstOrder && (firstOrder.DESCRIPTION || firstOrder._DESCRIPTION)) || (firstOrder && firstOrder.CODE), 'panel', 'coded'),
    specimen_code: asConcept(SYSTEMS.SPECIMEN, message.Specimen, message.Specimen, 'specimen', 'coded'),
    clinical_diagnosis: normalizeText(message.ClinicalDiagnosis),
    taken_datetime: message.TakenDateTime || null,
    collected_datetime: message.CollectedDateTime || null,
    received_in_lab_datetime: message.ReceivedInLabDateTime || null,
    priority: normalizeText(message.Priority),
    source_payload: { order_count: Array.isArray(message.TestOrders) ? message.TestOrders.length : 0, result_count: Array.isArray(message.TestResults) ? message.TestResults.length : 0 },
  };

  const lab_results = [];
  const isolates = [];
  const susceptibility_tests = [];
  const isolateIndexByKey = new Map();
  let isolateCounter = 0;
  let mostRecentIsolateIndex = null;

  for (const testResult of message.TestResults || []) {
    const testCode = normalizeCode(testResult?.TESTCODE || testResult?.ORDER?.CODE);
    const entries = testResult?.ORDER && Array.isArray(testResult.ORDER.ORDERS) ? testResult.ORDER.ORDERS : [];
    let activeIsolateIndex = null;
    const seenBlankObservationKeys = new Set();

    for (const entry of entries) {
      const code = normalizeCode(entry && entry.Code);
      const value = normalizeText(entry && entry.Value);
      const resultType = Number(entry && entry.ResultType);
      const isResulted = Boolean(entry && entry.IsResulted);
      const description = sanitizeDisplayName(entry && entry.Description, code || 'UNKNOWN');
      if (!code) continue;

      if (code === 'ORGS' && value) {
        const isolateKey = `${requestId}::${normalizeCode(value)}::${testCode || 'UNKNOWN'}`;
        let isolateIndex = isolateIndexByKey.get(isolateKey);
        if (!isolateIndex) {
          isolateCounter += 1;
          isolateIndex = isolateCounter;
          isolateIndexByKey.set(isolateKey, isolateIndex);
          isolates.push({
            isolate_index: isolateIndex,
            source_test_code: testCode,
            organism_code: asConcept(SYSTEMS.ORG, value, value, 'organism', 'coded'),
            source_observation_code: asConcept(SYSTEMS.TEST, code, description, 'test', 'coded'),
            raw_result: entry,
          });
        }
        activeIsolateIndex = isolateIndex;
        mostRecentIsolateIndex = isolateIndex;
        continue;
      }

      if (resultType === 4) {
        const linkedIsolateIndex = activeIsolateIndex || mostRecentIsolateIndex;
        if (!linkedIsolateIndex) {
          throw new Error(`Susceptibility result ${code} encountered before any organism identification for request ${requestId}`);
        }
        susceptibility_tests.push({
          isolate_index: linkedIsolateIndex,
          source_test_code: testCode,
          antibiotic_code: asConcept(SYSTEMS.ABX, code, description, 'antibiotic', 'coded'),
          susceptibility_value: value,
          raw_result: entry,
        });
        continue;
      }

      if (shouldSkipStructuralEntry(entry)) continue;
      const blankObservationKey = !value && !isResulted ? `${testCode || 'UNKNOWN'}::${code}::${resultType}` : null;
      if (blankObservationKey && seenBlankObservationKeys.has(blankObservationKey)) continue;
      if (blankObservationKey) seenBlankObservationKeys.add(blankObservationKey);

      lab_results.push({
        source_test_code: testCode,
        observation_code: asConcept(SYSTEMS.TEST, code, description, 'test', 'coded'),
        result_value: value,
        result_type: resultType,
        is_resulted: isResulted,
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
module.exports = { name: 'default-schema', version: '1.1.0', status: 'active', validate, convert };
