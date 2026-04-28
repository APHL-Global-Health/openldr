var SYSTEMS = {
  FACILITY: 'DEFAULT_FACILITY',
  TEST: 'DEFAULT_TEST',
  RESULT: 'DEFAULT_RESULT',
  SPECIMEN: 'DEFAULT_SPEC',
  ORG: 'DEFAULT_ORG',
  ABX: 'DEFAULT_ABX',
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
    datatype: datatype || 'coded',
    properties: properties || {},
  };
}

// ---------------------------------------------------------------------------
// CSV / TSV helpers
// ---------------------------------------------------------------------------

function parseDelimitedLine(line, delimiter) {
  var fields = [];
  var current = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line.charAt(i + 1) === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseDelimited(text, delimiter) {
  var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
  if (lines.length === 0) return { headers: [], rows: [] };
  var headers = parseDelimitedLine(lines[0], delimiter);
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var values = parseDelimitedLine(lines[i], delimiter);
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = j < values.length ? values[j] : '';
    }
    rows.push(row);
  }
  return { headers: headers, rows: rows };
}

function detectDelimiter(text) {
  var firstLine = text.split(/\r?\n/)[0] || '';
  var tabCount = firstLine.split('\t').length - 1;
  var commaCount = firstLine.split(',').length - 1;
  return tabCount > commaCount ? '\t' : ',';
}

// ---------------------------------------------------------------------------
// XML helpers (regex-based, no imports)
// ---------------------------------------------------------------------------

function xmlGetContent(xml, tagName) {
  var re = new RegExp('<' + tagName + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tagName + '>', 'i');
  var m = xml.match(re);
  return m ? m[1].trim() : null;
}

function xmlGetAllElements(xml, tagName) {
  var results = [];
  var re = new RegExp('<' + tagName + '(?:\\s[^>]*)?>[\\s\\S]*?<\\/' + tagName + '>', 'gi');
  var m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0]);
  }
  return results;
}

function xmlParseConceptElement(xml) {
  if (!xml) return null;
  var system_id = xmlGetContent(xml, 'system_id') || null;
  var concept_code = xmlGetContent(xml, 'concept_code') || null;
  if (!concept_code) return null;
  var display_name = xmlGetContent(xml, 'display_name') || null;
  var concept_class = xmlGetContent(xml, 'concept_class') || null;
  var datatype = xmlGetContent(xml, 'datatype') || 'coded';
  var propsXml = xmlGetContent(xml, 'properties');
  var properties = {};
  if (propsXml) {
    var propRe = /<([a-zA-Z_][a-zA-Z0-9_]*)>([^<]*)<\/\1>/g;
    var pm;
    while ((pm = propRe.exec(propsXml)) !== null) {
      properties[pm[1]] = pm[2];
    }
  }
  return {
    system_id: system_id,
    concept_code: concept_code,
    display_name: display_name || concept_code,
    concept_class: concept_class,
    datatype: datatype,
    properties: properties,
  };
}

function xmlParsePatient(xml) {
  var patientXml = xmlGetContent(xml, 'patient');
  if (!patientXml) return null;
  return {
    patient_guid: xmlGetContent(patientXml, 'patient_guid') || null,
    firstname: xmlGetContent(patientXml, 'firstname') || null,
    middlename: xmlGetContent(patientXml, 'middlename') || null,
    surname: xmlGetContent(patientXml, 'surname') || null,
    sex: xmlGetContent(patientXml, 'sex') || null,
    folder_no: xmlGetContent(patientXml, 'folder_no') || null,
    date_of_birth: xmlGetContent(patientXml, 'date_of_birth') || null,
    phone: xmlGetContent(patientXml, 'phone') || null,
    email: xmlGetContent(patientXml, 'email') || null,
    national_id: xmlGetContent(patientXml, 'national_id') || null,
    patient_data: {},
  };
}

function xmlParseLabRequest(xml) {
  var lrXml = xmlGetContent(xml, 'lab_request');
  if (!lrXml) return null;

  var facilityXml = xmlGetContent(lrXml, 'facility_code');
  var panelXml = xmlGetContent(lrXml, 'panel_code');
  var specimenXml = xmlGetContent(lrXml, 'specimen_code');
  var reqFacXml = xmlGetContent(lrXml, 'requesting_facility_code');
  var testFacXml = xmlGetContent(lrXml, 'testing_facility_code');

  return {
    request_id: xmlGetContent(lrXml, 'request_id') || null,
    facility_code: xmlParseConceptElement('<c>' + (facilityXml || '') + '</c>'),
    panel_code: xmlParseConceptElement('<c>' + (panelXml || '') + '</c>'),
    specimen_code: xmlParseConceptElement('<c>' + (specimenXml || '') + '</c>'),
    taken_datetime: xmlGetContent(lrXml, 'taken_datetime') || null,
    collected_datetime: xmlGetContent(lrXml, 'collected_datetime') || null,
    received_at: xmlGetContent(lrXml, 'received_at') || null,
    registered_at: xmlGetContent(lrXml, 'registered_at') || null,
    analysis_at: xmlGetContent(lrXml, 'analysis_at') || null,
    authorised_at: xmlGetContent(lrXml, 'authorised_at') || null,
    clinical_info: xmlGetContent(lrXml, 'clinical_info') || null,
    icd10_codes: xmlGetContent(lrXml, 'icd10_codes') || null,
    therapy: xmlGetContent(lrXml, 'therapy') || null,
    priority: xmlGetContent(lrXml, 'priority') || null,
    age_years: xmlGetContent(lrXml, 'age_years') != null ? Number(xmlGetContent(lrXml, 'age_years')) : null,
    age_days: xmlGetContent(lrXml, 'age_days') != null ? Number(xmlGetContent(lrXml, 'age_days')) : null,
    sex: xmlGetContent(lrXml, 'sex') || null,
    patient_class: xmlGetContent(lrXml, 'patient_class') || null,
    section_code: xmlGetContent(lrXml, 'section_code') || null,
    result_status: xmlGetContent(lrXml, 'result_status') || null,
    requesting_facility_code: reqFacXml ? xmlParseConceptElement('<c>' + reqFacXml + '</c>') : null,
    testing_facility_code: testFacXml ? xmlParseConceptElement('<c>' + testFacXml + '</c>') : null,
    requesting_doctor: xmlGetContent(lrXml, 'requesting_doctor') || null,
    tested_by: xmlGetContent(lrXml, 'tested_by') || null,
    authorised_by: xmlGetContent(lrXml, 'authorised_by') || null,
    source_payload: {},
  };
}

function xmlParseLabResult(resultXml) {
  var rawResultXml = xmlGetContent(resultXml, 'raw_result');
  var obsXml = xmlGetContent(resultXml, 'observation_code');
  return {
    source_test_code: xmlGetContent(resultXml, 'source_test_code') || null,
    obx_set_id: xmlGetContent(resultXml, 'obx_set_id') != null ? Number(xmlGetContent(resultXml, 'obx_set_id')) : null,
    obx_sub_id: xmlGetContent(resultXml, 'obx_sub_id') != null ? Number(xmlGetContent(resultXml, 'obx_sub_id')) : null,
    observation_code: xmlParseConceptElement('<c>' + (obsXml || '') + '</c>'),
    result_value: xmlGetContent(resultXml, 'result_value') || null,
    result_type: xmlGetContent(resultXml, 'result_type') || null,
    numeric_value: xmlGetContent(resultXml, 'numeric_value') != null ? Number(xmlGetContent(resultXml, 'numeric_value')) : null,
    coded_value: xmlGetContent(resultXml, 'coded_value') || null,
    text_value: xmlGetContent(resultXml, 'text_value') || null,
    numeric_units: xmlGetContent(resultXml, 'numeric_units') || null,
    abnormal_flag: xmlGetContent(resultXml, 'abnormal_flag') || null,
    rpt_units: xmlGetContent(resultXml, 'rpt_units') || null,
    rpt_flag: xmlGetContent(resultXml, 'rpt_flag') || null,
    rpt_range: xmlGetContent(resultXml, 'rpt_range') || null,
    result_timestamp: xmlGetContent(resultXml, 'result_timestamp') || null,
    isolate_index: xmlGetContent(resultXml, 'isolate_index') != null ? Number(xmlGetContent(resultXml, 'isolate_index')) : null,
    is_resulted: xmlGetContent(resultXml, 'is_resulted') === 'true',
    raw_result: rawResultXml ? {} : {},
  };
}

function xmlParseIsolate(isoXml) {
  var orgXml = xmlGetContent(isoXml, 'organism_code');
  return {
    isolate_index: xmlGetContent(isoXml, 'isolate_index') != null ? Number(xmlGetContent(isoXml, 'isolate_index')) : null,
    source_test_code: xmlGetContent(isoXml, 'source_test_code') || null,
    organism_code: xmlParseConceptElement('<c>' + (orgXml || '') + '</c>'),
    organism_type: xmlGetContent(isoXml, 'organism_type') || null,
    isolate_number: xmlGetContent(isoXml, 'isolate_number') || null,
    serotype: xmlGetContent(isoXml, 'serotype') || null,
    patient_age_days: xmlGetContent(isoXml, 'patient_age_days') != null ? Number(xmlGetContent(isoXml, 'patient_age_days')) : null,
    patient_sex: xmlGetContent(isoXml, 'patient_sex') || null,
    ward: xmlGetContent(isoXml, 'ward') || null,
    ward_type: xmlGetContent(isoXml, 'ward_type') || null,
    origin: xmlGetContent(isoXml, 'origin') || null,
    beta_lactamase: xmlGetContent(isoXml, 'beta_lactamase') || null,
    esbl: xmlGetContent(isoXml, 'esbl') || null,
    carbapenemase: xmlGetContent(isoXml, 'carbapenemase') || null,
    mrsa_screen: xmlGetContent(isoXml, 'mrsa_screen') || null,
    inducible_clinda: xmlGetContent(isoXml, 'inducible_clinda') || null,
    custom_fields: xmlGetContent(isoXml, 'custom_fields') || null,
    raw_result: {},
  };
}

function xmlParseSusceptibility(stXml) {
  var abxXml = xmlGetContent(stXml, 'antibiotic_code');
  return {
    isolate_index: xmlGetContent(stXml, 'isolate_index') != null ? Number(xmlGetContent(stXml, 'isolate_index')) : null,
    source_test_code: xmlGetContent(stXml, 'source_test_code') || null,
    antibiotic_code: xmlParseConceptElement('<c>' + (abxXml || '') + '</c>'),
    test_method: xmlGetContent(stXml, 'test_method') || null,
    disk_potency: xmlGetContent(stXml, 'disk_potency') || null,
    result_raw: xmlGetContent(stXml, 'result_raw') || null,
    result_numeric: xmlGetContent(stXml, 'result_numeric') != null ? Number(xmlGetContent(stXml, 'result_numeric')) : null,
    susceptibility_value: xmlGetContent(stXml, 'susceptibility_value') || null,
    quantitative_value: xmlGetContent(stXml, 'quantitative_value') || null,
    guideline: xmlGetContent(stXml, 'guideline') || null,
    guideline_version: xmlGetContent(stXml, 'guideline_version') || null,
    raw_result: {},
  };
}

function parseXMLMessage(xml) {
  var patient = xmlParsePatient(xml);
  var lab_request = xmlParseLabRequest(xml);

  var lab_results = [];
  var resultsContainer = xmlGetContent(xml, 'lab_results') || '';
  var resultEls = xmlGetAllElements(resultsContainer, 'result');
  for (var i = 0; i < resultEls.length; i++) {
    lab_results.push(xmlParseLabResult(resultEls[i]));
  }

  var isolates = [];
  var isolatesContainer = xmlGetContent(xml, 'isolates') || '';
  var isoEls = xmlGetAllElements(isolatesContainer, 'isolate');
  for (var j = 0; j < isoEls.length; j++) {
    isolates.push(xmlParseIsolate(isoEls[j]));
  }

  var susceptibility_tests = [];
  var stContainer = xmlGetContent(xml, 'susceptibility_tests') || '';
  var stEls = xmlGetAllElements(stContainer, 'test');
  for (var k = 0; k < stEls.length; k++) {
    susceptibility_tests.push(xmlParseSusceptibility(stEls[k]));
  }

  return {
    patient: patient,
    lab_request: lab_request,
    lab_results: lab_results,
    isolates: isolates,
    susceptibility_tests: susceptibility_tests,
  };
}

// ---------------------------------------------------------------------------
// CSV-to-canonical mapping
// ---------------------------------------------------------------------------

function csvRowToRecord(row) {
  var facilityCode = row['facility_code'] || null;
  var facilityName = row['facility_name'] || facilityCode;
  var panelCode = row['panel_code'] || null;
  var panelName = row['panel_name'] || panelCode;
  var specimenCode = row['specimen_code'] || null;
  var specimenName = row['specimen_name'] || specimenCode;
  var obsCode = row['observation_code'] || row['test_code'] || null;
  var obsName = row['observation_name'] || row['test_name'] || obsCode;
  var reqFacCode = row['requesting_facility_code'] || null;
  var reqFacName = row['requesting_facility_name'] || reqFacCode;
  var testFacCode = row['testing_facility_code'] || null;
  var testFacName = row['testing_facility_name'] || testFacCode;

  return {
    patient: {
      patient_guid: row['patient_guid'] || null,
      firstname: row['firstname'] || null,
      middlename: row['middlename'] || null,
      surname: row['surname'] || null,
      sex: row['sex'] || null,
      folder_no: row['folder_no'] || null,
      date_of_birth: row['date_of_birth'] || null,
      phone: row['phone'] || null,
      email: row['email'] || null,
      national_id: row['national_id'] || null,
      patient_data: {},
    },
    lab_request: {
      request_id: row['request_id'] || null,
      facility_code: facilityCode ? asConcept(row['facility_system_id'] || SYSTEMS.FACILITY, facilityCode, facilityName, 'facility', 'coded') : null,
      panel_code: panelCode ? asConcept(row['panel_system_id'] || SYSTEMS.TEST, panelCode, panelName, 'panel', 'coded') : null,
      specimen_code: specimenCode ? asConcept(row['specimen_system_id'] || SYSTEMS.SPECIMEN, specimenCode, specimenName, 'specimen', 'coded') : null,
      taken_datetime: row['taken_datetime'] || null,
      collected_datetime: row['collected_datetime'] || null,
      received_at: row['received_at'] || null,
      registered_at: row['registered_at'] || null,
      analysis_at: row['analysis_at'] || null,
      authorised_at: row['authorised_at'] || null,
      clinical_info: row['clinical_info'] || null,
      icd10_codes: row['icd10_codes'] || null,
      therapy: row['therapy'] || null,
      priority: row['priority'] || null,
      age_years: row['age_years'] ? Number(row['age_years']) : null,
      age_days: row['age_days'] ? Number(row['age_days']) : null,
      sex: row['req_sex'] || row['sex'] || null,
      patient_class: row['patient_class'] || null,
      section_code: row['section_code'] || null,
      result_status: row['result_status'] || null,
      requesting_facility_code: reqFacCode ? asConcept(row['requesting_facility_system_id'] || SYSTEMS.FACILITY, reqFacCode, reqFacName, 'facility', 'coded') : null,
      testing_facility_code: testFacCode ? asConcept(row['testing_facility_system_id'] || SYSTEMS.FACILITY, testFacCode, testFacName, 'facility', 'coded') : null,
      requesting_doctor: row['requesting_doctor'] || null,
      tested_by: row['tested_by'] || null,
      authorised_by: row['authorised_by'] || null,
      source_payload: {},
    },
    lab_results: obsCode ? [{
      source_test_code: row['source_test_code'] || null,
      obx_set_id: row['obx_set_id'] ? Number(row['obx_set_id']) : null,
      obx_sub_id: row['obx_sub_id'] ? Number(row['obx_sub_id']) : null,
      observation_code: asConcept(row['obs_system_id'] || SYSTEMS.TEST, obsCode, obsName, 'test', 'coded'),
      result_value: row['result_value'] || null,
      result_type: row['result_type'] || null,
      numeric_value: row['numeric_value'] ? Number(row['numeric_value']) : null,
      coded_value: row['coded_value'] || null,
      text_value: row['text_value'] || null,
      numeric_units: row['numeric_units'] || null,
      abnormal_flag: row['abnormal_flag'] || null,
      rpt_units: row['rpt_units'] || null,
      rpt_flag: row['rpt_flag'] || null,
      rpt_range: row['rpt_range'] || null,
      result_timestamp: row['result_timestamp'] || null,
      isolate_index: row['isolate_index'] ? Number(row['isolate_index']) : null,
      is_resulted: row['is_resulted'] === 'true',
      raw_result: {},
    }] : [],
    isolates: [],
    susceptibility_tests: [],
  };
}

function parseCSVMessage(text, delimiter) {
  var delim = delimiter || detectDelimiter(text);
  var parsed = parseDelimited(text, delim);
  if (parsed.rows.length === 0) return null;

  // Group rows by request_id
  var groups = {};
  var groupOrder = [];
  for (var i = 0; i < parsed.rows.length; i++) {
    var row = parsed.rows[i];
    var reqId = row['request_id'] || 'UNKNOWN-' + i;
    if (!groups[reqId]) {
      groups[reqId] = [];
      groupOrder.push(reqId);
    }
    groups[reqId].push(row);
  }

  var records = [];
  for (var g = 0; g < groupOrder.length; g++) {
    var rows = groups[groupOrder[g]];
    var base = csvRowToRecord(rows[0]);
    // Merge additional rows as extra lab_results
    for (var r = 1; r < rows.length; r++) {
      var extra = csvRowToRecord(rows[r]);
      if (extra.lab_results.length > 0) {
        base.lab_results = base.lab_results.concat(extra.lab_results);
      }
    }
    records.push(base);
  }

  return records;
}

// ---------------------------------------------------------------------------
// JSONL helpers
// ---------------------------------------------------------------------------

function parseJSONLMessage(text) {
  var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
  var records = [];
  for (var i = 0; i < lines.length; i++) {
    records.push(JSON.parse(lines[i]));
  }
  return records;
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

// Convert Buffer-like objects { type: "Buffer", data: [...] } or _binary
// wrappers to a UTF-8 string so downstream detection works on text.
function coerceToStringOrObject(message) {
  if (typeof message === 'string') return message;
  if (typeof message !== 'object' || message === null) return message;

  // Serialised Buffer: { type: "Buffer", data: [byte, byte, ...] }
  if (message.type === 'Buffer' && Array.isArray(message.data)) {
    var chars = [];
    for (var i = 0; i < message.data.length; i++) {
      chars.push(String.fromCharCode(message.data[i]));
    }
    return chars.join('');
  }

  // Node Buffer with toString (may exist in low-security sandbox)
  if (typeof message.toString === 'function' && message.constructor && message.constructor.name === 'Buffer') {
    return message.toString('utf8');
  }

  return message;
}

function detectFormat(message) {
  if (typeof message === 'object' && message !== null) {
    // Buffer-like — will be coerced to string in parseMessage
    if (message.type === 'Buffer' && Array.isArray(message.data)) return 'buffer';
    return 'json';
  }
  if (typeof message !== 'string') return 'unknown';
  var trimmed = message.trim();
  if (trimmed.charAt(0) === '<') return 'xml';
  // JSONL: multiple lines each starting with {
  var lines = trimmed.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
  if (lines.length > 0 && lines[0].trim().charAt(0) === '{') {
    if (lines.length > 1) return 'jsonl';
    // Single-line JSON string — parse as JSON object
    return 'json-string';
  }
  // Detect TSV vs CSV by checking first line for tabs
  var firstLine = trimmed.split(/\r?\n/)[0] || '';
  var tabCount = firstLine.split('\t').length - 1;
  var commaCount = firstLine.split(',').length - 1;
  if (tabCount > commaCount) return 'tsv';
  return 'csv';
}

function parseMessage(message) {
  var format = detectFormat(message);

  // If buffer-like, coerce to string and re-detect
  if (format === 'buffer') {
    return parseMessage(coerceToStringOrObject(message));
  }

  if (format === 'json') return { format: 'json', records: [message] };
  if (format === 'json-string') return { format: 'json', records: [JSON.parse(message)] };
  if (format === 'xml') return { format: 'xml', records: [parseXMLMessage(message)] };
  if (format === 'jsonl') return { format: 'jsonl', records: parseJSONLMessage(message) };
  if (format === 'tsv') {
    var tsvRecords = parseCSVMessage(message, '\t');
    return { format: 'tsv', records: tsvRecords || [] };
  }
  if (format === 'csv') {
    var csvRecords = parseCSVMessage(message, ',');
    return { format: 'csv', records: csvRecords || [] };
  }
  return { format: 'unknown', records: [] };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRecord(record) {
  var errors = [];
  if (!record || typeof record !== 'object') {
    errors.push('Record must be an object');
    return errors;
  }
  if (!record.lab_request || typeof record.lab_request !== 'object') errors.push('lab_request object is required');
  if (!Array.isArray(record.lab_results)) errors.push('lab_results must be an array');
  if (record.lab_request && !record.lab_request.request_id) errors.push('lab_request.request_id is required');
  return errors;
}

function validate(message) {
  var parsed = parseMessage(message);

  if (parsed.records.length === 0) {
    return {
      valid: false,
      reason: 'Canonical schema validation failed',
      details: { errors: ['No records found in ' + parsed.format + ' input'] },
    };
  }

  var allErrors = [];
  for (var i = 0; i < parsed.records.length; i++) {
    var errors = validateRecord(parsed.records[i]);
    for (var j = 0; j < errors.length; j++) {
      allErrors.push('Record ' + (i + 1) + ': ' + errors[j]);
    }
  }

  return {
    valid: allErrors.length === 0,
    reason: allErrors.length === 0 ? null : 'Canonical schema validation failed',
    details: allErrors.length === 0 ? {} : { errors: allErrors },
  };
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

// Default system_id for a concept field if missing
function ensureSystem(concept, defaultSystem) {
  if (!concept || typeof concept !== 'object') return concept;
  if (!concept.system_id) {
    concept.system_id = defaultSystem;
  }
  return concept;
}

function convertRecord(record) {
  var out = {
    patient: record.patient || null,
    lab_request: record.lab_request,
    lab_results: Array.isArray(record.lab_results) ? record.lab_results : [],
    isolates: Array.isArray(record.isolates) ? record.isolates : [],
    susceptibility_tests: Array.isArray(record.susceptibility_tests) ? record.susceptibility_tests : [],
    _metadata: record._metadata || {},
    _plugin: record._plugin || {
      plugin_name: 'default-schema',
      plugin_version: '1.4.0',
      source_system: 'Canonical',
    },
  };

  // Assign obr_set_id if missing
  if (!out.lab_request.obr_set_id) {
    out.lab_request.obr_set_id = 1;
  }

  // Default system_id on lab_request concept fields
  ensureSystem(out.lab_request.facility_code, SYSTEMS.FACILITY);
  ensureSystem(out.lab_request.panel_code, SYSTEMS.TEST);
  ensureSystem(out.lab_request.specimen_code, SYSTEMS.SPECIMEN);
  ensureSystem(out.lab_request.requesting_facility_code, SYSTEMS.FACILITY);
  ensureSystem(out.lab_request.testing_facility_code, SYSTEMS.FACILITY);

  // Default system_id on lab_results concept fields
  for (var i = 0; i < out.lab_results.length; i++) {
    ensureSystem(out.lab_results[i].observation_code, SYSTEMS.TEST);
  }

  // Default system_id on isolate concept fields
  for (var j = 0; j < out.isolates.length; j++) {
    ensureSystem(out.isolates[j].organism_code, SYSTEMS.ORG);
  }

  // Default system_id on susceptibility_tests concept fields
  for (var k = 0; k < out.susceptibility_tests.length; k++) {
    ensureSystem(out.susceptibility_tests[k].antibiotic_code, SYSTEMS.ABX);
  }

  // Mirror each susceptibility_test as a lab_results entry. lab_results is the
  // unified, general-form index of every result (including AMR); the structured
  // per-antibiotic detail stays in susceptibility_tests for richer queries.
  // Matches hl7-fhir.schema.js, where descendant AST observations are appended
  // to lab_results alongside their susceptibility_tests rows.
  var nextSetId = out.lab_results.length + 1;
  for (var s = 0; s < out.susceptibility_tests.length; s++) {
    var st = out.susceptibility_tests[s];
    if (!st || !st.antibiotic_code) continue;
    out.lab_results.push({
      source_test_code: st.source_test_code || null,
      obx_set_id: nextSetId++,
      obx_sub_id: 0,
      observation_code: st.antibiotic_code,
      result_value: st.result_raw != null ? String(st.result_raw) : (st.susceptibility_value || null),
      result_type: 'CE',
      numeric_value: st.result_numeric != null ? Number(st.result_numeric) : null,
      coded_value: st.susceptibility_value || null,
      text_value: null,
      numeric_units: null,
      abnormal_flag: null,
      rpt_units: null,
      rpt_flag: null,
      rpt_range: null,
      result_timestamp: null,
      isolate_index: st.isolate_index != null ? Number(st.isolate_index) : null,
      is_resulted: true,
      raw_result: st.raw_result || {},
    });
  }

  return out;
}

function convert(message) {
  var parsed = parseMessage(message);
  var results = [];
  for (var i = 0; i < parsed.records.length; i++) {
    results.push(convertRecord(parsed.records[i]));
  }
  return results;
}

module.exports = { name: 'default-schema', version: '1.4.0', status: 'active', validate: validate, convert: convert };
