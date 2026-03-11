var SYSTEMS = {
  FACILITY: 'FHIR_FACILITY',
  TEST: 'LOINC',
  SPECIMEN: 'FHIR_SPECIMEN',
  ORG: 'FHIR_ORG',
  ABX: 'FHIR_ABX',
};

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  var text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

function normalizeCode(value) {
  var text = normalizeText(value);
  return text ? text.toUpperCase() : null;
}

function asConcept(system_id, concept_code, display_name, concept_class, datatype, properties) {
  var normalizedCode = normalizeCode(concept_code);
  if (!normalizedCode) return null;
  return {
    system_id: system_id,
    concept_code: normalizedCode,
    display_name: normalizeText(display_name) || normalizedCode,
    concept_class: concept_class,
    datatype: datatype,
    properties: properties || {},
  };
}

function findResourcesByType(bundle, resourceType) {
  if (!bundle || !Array.isArray(bundle.entry)) return [];
  var results = [];
  for (var i = 0; i < bundle.entry.length; i++) {
    var entry = bundle.entry[i];
    var resource = entry && entry.resource;
    if (resource && resource.resourceType === resourceType) {
      results.push(resource);
    }
  }
  return results;
}

function findResourceById(bundle, reference) {
  if (!bundle || !reference) return null;
  var parts = reference.split('/');
  var resourceType = parts.length === 2 ? parts[0] : null;
  var id = parts.length === 2 ? parts[1] : parts[0];
  if (!Array.isArray(bundle.entry)) return null;
  for (var i = 0; i < bundle.entry.length; i++) {
    var resource = bundle.entry[i] && bundle.entry[i].resource;
    if (!resource) continue;
    if (resourceType && resource.resourceType === resourceType && resource.id === id) return resource;
    if (!resourceType && resource.id === id) return resource;
  }
  return null;
}

function getCoding(codeableConcept) {
  if (!codeableConcept) return null;
  if (Array.isArray(codeableConcept.coding) && codeableConcept.coding.length > 0) {
    return codeableConcept.coding[0];
  }
  return null;
}

function getObservationValue(obs) {
  if (obs.valueQuantity) return String(obs.valueQuantity.value);
  if (obs.valueString) return obs.valueString;
  if (obs.valueCodeableConcept) {
    var coding = getCoding(obs.valueCodeableConcept);
    return coding ? (coding.display || coding.code) : null;
  }
  if (obs.valueBoolean !== undefined) return String(obs.valueBoolean);
  if (obs.valueInteger !== undefined) return String(obs.valueInteger);
  return null;
}

function validate(message) {
  var errors = [];
  if (!message || typeof message !== 'object') {
    errors.push('Message must be a JSON object');
    return { valid: false, reason: 'FHIR JSON validation failed', details: { errors: errors } };
  }

  var resourceType = message.resourceType;

  if (resourceType === 'Bundle') {
    if (!Array.isArray(message.entry) || message.entry.length === 0) {
      errors.push('Bundle must contain at least one entry');
    }
    var diagnosticReports = findResourcesByType(message, 'DiagnosticReport');
    if (diagnosticReports.length === 0) {
      errors.push('Bundle must contain at least one DiagnosticReport resource');
    }
  } else if (resourceType === 'DiagnosticReport') {
    if (!message.status) errors.push('DiagnosticReport.status is required');
  } else {
    errors.push('Root resourceType must be Bundle or DiagnosticReport, got: ' + (resourceType || 'undefined'));
  }

  return {
    valid: errors.length === 0,
    reason: errors.length === 0 ? null : 'FHIR JSON validation failed',
    details: errors.length === 0 ? {} : { errors: errors },
  };
}

function convertDiagnosticReport(report, bundle) {
  var patient = null;
  if (report.subject && report.subject.reference) {
    patient = bundle ? findResourceById(bundle, report.subject.reference) : null;
  }

  var patientName = patient && Array.isArray(patient.name) && patient.name.length > 0 ? patient.name[0] : null;
  var patientIdentifier = patient && Array.isArray(patient.identifier) && patient.identifier.length > 0
    ? patient.identifier[0].value : null;

  var facilityDisplay = null;
  var facilityCode = null;
  if (Array.isArray(report.performer) && report.performer.length > 0) {
    var performer = report.performer[0];
    facilityDisplay = performer.display || null;
    facilityCode = (performer.identifier && performer.identifier.value) || facilityDisplay;
  }

  var reportCoding = getCoding(report.code);
  var requestId = report.id || (patient && patient.id) || null;

  var specimenCode = null;
  if (Array.isArray(report.specimen) && report.specimen.length > 0) {
    var specimenRef = report.specimen[0];
    var specimenResource = bundle ? findResourceById(bundle, specimenRef.reference || '') : null;
    if (specimenResource && specimenResource.type) {
      var specCoding = getCoding(specimenResource.type);
      specimenCode = specCoding ? specCoding.code : null;
    }
    if (!specimenCode && specimenRef.display) specimenCode = specimenRef.display;
    if (!specimenCode && specimenRef.reference) specimenCode = specimenRef.reference;
  }

  var lab_results = [];
  var isolates = [];
  var susceptibility_tests = [];

  var observations = [];
  if (Array.isArray(report.result)) {
    for (var i = 0; i < report.result.length; i++) {
      var resultRef = report.result[i];
      var obs = resultRef.resource || (bundle ? findResourceById(bundle, resultRef.reference || '') : null);
      if (obs) observations.push(obs);
    }
  }

  for (var j = 0; j < observations.length; j++) {
    var obs = observations[j];
    var obsCoding = getCoding(obs.code);
    var code = obsCoding ? obsCoding.code : null;
    var display = obsCoding ? (obsCoding.display || code) : null;
    var value = getObservationValue(obs);

    lab_results.push({
      source_test_code: reportCoding ? reportCoding.code : null,
      observation_code: asConcept(SYSTEMS.TEST, code, display, 'test', 'coded'),
      result_value: value,
      result_type: obs.valueQuantity ? 1 : 0,
      is_resulted: value !== null,
      raw_result: obs,
    });
  }

  return {
    patient: {
      patient_guid: patient ? patient.id : requestId,
      firstname: patientName ? (Array.isArray(patientName.given) ? patientName.given[0] : null) : null,
      middlename: patientName ? (Array.isArray(patientName.given) && patientName.given.length > 1 ? patientName.given[1] : null) : null,
      surname: patientName ? patientName.family : null,
      sex: patient ? (patient.gender ? patient.gender.charAt(0).toUpperCase() : 'U') : 'U',
      folder_no: patientIdentifier,
      address: null,
      patient_data: { raw: patient || {} },
    },
    lab_request: {
      request_id: requestId,
      facility_code: asConcept(SYSTEMS.FACILITY, facilityCode, facilityDisplay, 'facility', 'coded'),
      panel_code: reportCoding ? asConcept(SYSTEMS.TEST, reportCoding.code, reportCoding.display || reportCoding.code, 'panel', 'coded') : null,
      specimen_code: specimenCode ? asConcept(SYSTEMS.SPECIMEN, specimenCode, specimenCode, 'specimen', 'coded') : null,
      clinical_diagnosis: null,
      taken_datetime: report.effectiveDateTime || null,
      collected_datetime: null,
      received_in_lab_datetime: null,
      priority: null,
      source_payload: { result_count: observations.length },
    },
    lab_results: lab_results,
    isolates: isolates,
    susceptibility_tests: susceptibility_tests,
  };
}

function convert(message) {
  var bundle = null;
  var reports = [];

  if (message.resourceType === 'Bundle') {
    bundle = message;
    reports = findResourcesByType(message, 'DiagnosticReport');
  } else if (message.resourceType === 'DiagnosticReport') {
    reports = [message];
  }

  if (reports.length === 0) {
    return {
      patient: { patient_guid: null },
      lab_request: { request_id: null, facility_code: null },
      lab_results: [],
      isolates: [],
      susceptibility_tests: [],
      _plugin: { plugin_name: 'fhir-json-schema', plugin_version: '1.0.0', source_system: 'FHIR JSON' },
    };
  }

  var primary = convertDiagnosticReport(reports[0], bundle);
  primary._plugin = {
    plugin_name: 'fhir-json-schema',
    plugin_version: '1.0.0',
    source_system: 'FHIR JSON (Bundle/DiagnosticReport)',
  };

  return primary;
}

module.exports = { name: 'fhir-json-schema', version: '1.0.0', status: 'active', validate: validate, convert: convert };
