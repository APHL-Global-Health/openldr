var SYSTEMS = {
  FACILITY: 'FHIR_FACILITY',
  TEST: 'LOINC',
  SPECIMEN: 'FHIR_SPECIMEN',
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

// Minimal XML parser for sandbox (no require/import)
function getAttr(tag, attrName) {
  var re = new RegExp(attrName + '\\s*=\\s*"([^"]*)"');
  var m = tag.match(re);
  return m ? m[1] : null;
}

function findElements(xml, tagName) {
  var results = [];
  // Match both self-closing and content tags, namespace-agnostic
  var re = new RegExp('<(?:[a-zA-Z0-9]+:)?' + tagName + '(?:\\s[^>]*)?\\/>', 'g');
  var m;
  while ((m = re.exec(xml)) !== null) {
    results.push({ tag: m[0], content: '', selfClosing: true });
  }
  var re2 = new RegExp('<(?:[a-zA-Z0-9]+:)?' + tagName + '(?:\\s[^>]*)?>((?:.|\\n|\\r)*?)<\\/(?:[a-zA-Z0-9]+:)?' + tagName + '>', 'g');
  while ((m = re2.exec(xml)) !== null) {
    results.push({ tag: m[0], content: m[1], selfClosing: false });
  }
  return results;
}

function findFirstElement(xml, tagName) {
  var els = findElements(xml, tagName);
  return els.length > 0 ? els[0] : null;
}

function getValueAttr(xml, tagName) {
  var el = findFirstElement(xml, tagName);
  if (!el) return null;
  return getAttr(el.tag, 'value');
}

function validate(message) {
  var errors = [];
  var text = typeof message === 'string' ? message : String(message);

  if (!text || text.trim().length === 0) {
    errors.push('XML content is empty');
    return { valid: false, reason: 'FHIR XML validation failed', details: { errors: errors } };
  }

  var hasBundle = text.indexOf('<Bundle') >= 0;
  var hasDiagnosticReport = text.indexOf('<DiagnosticReport') >= 0;

  if (!hasBundle && !hasDiagnosticReport) {
    errors.push('FHIR XML must contain a Bundle or DiagnosticReport resource');
  }

  if (hasBundle) {
    var entries = findElements(text, 'entry');
    if (entries.length === 0) {
      errors.push('Bundle must contain at least one entry');
    }
    if (!hasDiagnosticReport) {
      errors.push('Bundle must contain at least one DiagnosticReport resource');
    }
  }

  return {
    valid: errors.length === 0,
    reason: errors.length === 0 ? null : 'FHIR XML validation failed',
    details: errors.length === 0 ? {} : { errors: errors },
  };
}

function convert(message) {
  var xml = typeof message === 'string' ? message : String(message);

  // Extract DiagnosticReport
  var reportEl = findFirstElement(xml, 'DiagnosticReport');
  var reportXml = reportEl ? (reportEl.selfClosing ? reportEl.tag : reportEl.tag) : xml;

  // Extract Patient
  var patientEl = findFirstElement(xml, 'Patient');
  var patientXml = patientEl ? patientEl.tag : '';

  // Patient info
  var patientId = patientEl ? getValueAttr(patientXml, 'id') : null;
  var familyName = patientEl ? getValueAttr(patientXml, 'family') : null;
  var givenName = patientEl ? getValueAttr(patientXml, 'given') : null;
  var gender = patientEl ? getValueAttr(patientXml, 'gender') : null;

  // Performer / facility
  var performerEl = findFirstElement(reportXml, 'performer');
  var facilityDisplay = performerEl ? getValueAttr(performerEl.tag, 'display') : null;
  var facilityCode = facilityDisplay;

  // Report status and code
  var reportStatus = getValueAttr(reportXml, 'status');
  var reportCodeEl = findFirstElement(reportXml, 'code');
  var reportCodingEl = reportCodeEl ? findFirstElement(reportCodeEl.tag, 'coding') : null;
  var reportCodeValue = reportCodingEl ? getValueAttr(reportCodingEl.tag, 'code') : null;

  // Subject reference
  var subjectEl = findFirstElement(reportXml, 'subject');
  var subjectRef = subjectEl ? getValueAttr(subjectEl.tag, 'reference') : null;

  // Observations
  var observationEls = findElements(xml, 'Observation');
  var lab_results = [];

  for (var i = 0; i < observationEls.length; i++) {
    var obsXml = observationEls[i].tag;
    var obsCodeEl = findFirstElement(obsXml, 'code');
    var obsCodingEl = obsCodeEl ? findFirstElement(obsCodeEl.tag, 'coding') : null;
    var obsCode = obsCodingEl ? getValueAttr(obsCodingEl.tag, 'code') : null;
    var obsDisplay = obsCodingEl ? getValueAttr(obsCodingEl.tag, 'display') : null;

    var valueEl = findFirstElement(obsXml, 'valueQuantity');
    var valueStr = null;
    var isNumeric = false;
    if (valueEl) {
      valueStr = getValueAttr(valueEl.tag, 'value');
      isNumeric = true;
    } else {
      var valueStringEl = findFirstElement(obsXml, 'valueString');
      if (valueStringEl) valueStr = getAttr(valueStringEl.tag, 'value');
    }

    if (obsCode) {
      lab_results.push({
        source_test_code: reportCodeValue,
        observation_code: asConcept(SYSTEMS.TEST, obsCode, obsDisplay || obsCode, 'test', 'coded'),
        result_value: valueStr,
        result_type: isNumeric ? 1 : 0,
        is_resulted: valueStr !== null,
        raw_result: { xml_fragment: obsXml },
      });
    }
  }

  var requestId = patientId || subjectRef || null;

  return {
    patient: {
      patient_guid: patientId,
      firstname: normalizeText(givenName),
      middlename: null,
      surname: normalizeText(familyName),
      sex: gender ? gender.charAt(0).toUpperCase() : 'U',
      folder_no: patientId,
      address: null,
      patient_data: { raw_xml: patientXml || null },
    },
    lab_request: {
      request_id: requestId,
      facility_code: asConcept(SYSTEMS.FACILITY, facilityCode, facilityDisplay, 'facility', 'coded'),
      panel_code: reportCodeValue ? asConcept(SYSTEMS.TEST, reportCodeValue, reportCodeValue, 'panel', 'coded') : null,
      specimen_code: null,
      clinical_diagnosis: null,
      taken_datetime: null,
      collected_datetime: null,
      received_in_lab_datetime: null,
      priority: null,
      source_payload: { status: reportStatus, observation_count: lab_results.length },
    },
    lab_results: lab_results,
    isolates: [],
    susceptibility_tests: [],
    _plugin: {
      plugin_name: 'fhir-xml-schema',
      plugin_version: '1.0.0',
      source_system: 'FHIR XML (Bundle/DiagnosticReport)',
    },
  };
}

module.exports = { name: 'fhir-xml-schema', version: '1.0.0', status: 'active', validate: validate, convert: convert };
