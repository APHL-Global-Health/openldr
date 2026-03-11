var SYSTEMS = {
  FACILITY: 'CSV_FACILITY',
  TEST: 'CSV_TEST',
  SPECIMEN: 'CSV_SPECIMEN',
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

function parseCSV(text) {
  var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
  if (lines.length === 0) return { headers: [], rows: [] };

  var headers = parseCSVLine(lines[0]);
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var values = parseCSVLine(lines[i]);
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j].trim().toLowerCase()] = j < values.length ? values[j] : '';
    }
    rows.push(row);
  }
  return { headers: headers, rows: rows };
}

function parseCSVLine(line) {
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
      } else if (ch === ',') {
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

// Known aliases for required columns
var COLUMN_ALIASES = {
  facility_code: ['facility_code', 'facilitycode', 'facility', 'fac_code', 'site_code', 'sitecode'],
  lab_number: ['lab_number', 'labnumber', 'lab_no', 'labno', 'accession', 'accession_number', 'sample_id', 'sampleid'],
  test_code: ['test_code', 'testcode', 'test', 'analyte_code', 'analytecode', 'observation_code'],
  result_value: ['result_value', 'resultvalue', 'result', 'value', 'test_result', 'testresult'],
};

function findColumn(headers, aliases) {
  var lowerHeaders = headers.map(function (h) { return h.trim().toLowerCase(); });
  for (var i = 0; i < aliases.length; i++) {
    if (lowerHeaders.indexOf(aliases[i]) >= 0) return aliases[i];
  }
  return null;
}

function validate(message) {
  var errors = [];
  var text = typeof message === 'string' ? message : String(message);

  if (!text || text.trim().length === 0) {
    errors.push('CSV content is empty');
    return { valid: false, reason: 'CSV validation failed', details: { errors: errors } };
  }

  var parsed = parseCSV(text);
  if (parsed.headers.length === 0) {
    errors.push('CSV must have a header row');
    return { valid: false, reason: 'CSV validation failed', details: { errors: errors } };
  }

  if (parsed.rows.length === 0) {
    errors.push('CSV must have at least one data row');
  }

  var facilityCol = findColumn(parsed.headers, COLUMN_ALIASES.facility_code);
  var labNumberCol = findColumn(parsed.headers, COLUMN_ALIASES.lab_number);
  var testCodeCol = findColumn(parsed.headers, COLUMN_ALIASES.test_code);
  var resultCol = findColumn(parsed.headers, COLUMN_ALIASES.result_value);

  if (!facilityCol) errors.push('Required column missing: facility_code (or alias: ' + COLUMN_ALIASES.facility_code.join(', ') + ')');
  if (!labNumberCol) errors.push('Required column missing: lab_number (or alias: ' + COLUMN_ALIASES.lab_number.join(', ') + ')');
  if (!testCodeCol) errors.push('Required column missing: test_code (or alias: ' + COLUMN_ALIASES.test_code.join(', ') + ')');
  if (!resultCol) errors.push('Required column missing: result_value (or alias: ' + COLUMN_ALIASES.result_value.join(', ') + ')');

  return {
    valid: errors.length === 0,
    reason: errors.length === 0 ? null : 'CSV validation failed',
    details: errors.length === 0
      ? { row_count: parsed.rows.length, column_count: parsed.headers.length }
      : { errors: errors, headers_found: parsed.headers },
  };
}

function convert(message) {
  var text = typeof message === 'string' ? message : String(message);
  var parsed = parseCSV(text);

  var facilityCol = findColumn(parsed.headers, COLUMN_ALIASES.facility_code) || 'facility_code';
  var labNumberCol = findColumn(parsed.headers, COLUMN_ALIASES.lab_number) || 'lab_number';
  var testCodeCol = findColumn(parsed.headers, COLUMN_ALIASES.test_code) || 'test_code';
  var resultCol = findColumn(parsed.headers, COLUMN_ALIASES.result_value) || 'result_value';

  // Group rows by lab_number to build per-request results
  var groups = {};
  var groupOrder = [];
  for (var i = 0; i < parsed.rows.length; i++) {
    var row = parsed.rows[i];
    var labNum = row[labNumberCol] || 'UNKNOWN-' + i;
    if (!groups[labNum]) {
      groups[labNum] = [];
      groupOrder.push(labNum);
    }
    groups[labNum].push(row);
  }

  // Use the first group as the primary record
  var primaryLabNumber = groupOrder[0] || 'UNKNOWN';
  var primaryRows = groups[primaryLabNumber] || [];
  var firstRow = primaryRows[0] || {};

  var lab_results = [];
  for (var j = 0; j < primaryRows.length; j++) {
    var r = primaryRows[j];
    var code = r[testCodeCol] || '';
    var name = r['test_name'] || r['testname'] || r['test_description'] || code;
    var value = r[resultCol] || '';
    var unit = r['result_unit'] || r['unit'] || r['units'] || '';
    var range = r['reference_range'] || r['ref_range'] || r['normal_range'] || '';

    lab_results.push({
      source_test_code: normalizeCode(code),
      observation_code: asConcept(SYSTEMS.TEST, code, name, 'test', 'coded', {
        unit: normalizeText(unit),
        reference_range: normalizeText(range),
      }),
      result_value: normalizeText(value),
      result_type: isNaN(Number(value)) ? 0 : 1,
      is_resulted: Boolean(value && value.trim().length > 0),
      raw_result: r,
    });
  }

  var facilityCode = firstRow[facilityCol] || '';
  var facilityName = firstRow['facility_name'] || firstRow['facilityname'] || firstRow['site_name'] || facilityCode;
  var specimen = firstRow['specimen'] || firstRow['specimen_type'] || firstRow['sample_type'] || null;
  var takenDatetime = firstRow['taken_datetime'] || firstRow['collection_date'] || firstRow['collected_datetime'] || null;

  return {
    patient: {
      patient_guid: primaryLabNumber,
      firstname: normalizeText(firstRow['patient_firstname'] || firstRow['firstname'] || firstRow['first_name'] || null),
      middlename: normalizeText(firstRow['patient_middlename'] || firstRow['middlename'] || null),
      surname: normalizeText(firstRow['patient_surname'] || firstRow['surname'] || firstRow['last_name'] || firstRow['lastname'] || null),
      sex: normalizeText(firstRow['sex'] || firstRow['gender'] || null) || 'U',
      folder_no: normalizeText(firstRow['folder_no'] || firstRow['folderno'] || firstRow['patient_id'] || null),
      address: normalizeText(firstRow['address'] || firstRow['patient_address'] || null),
      patient_data: {
        source_lab_number: primaryLabNumber,
        total_groups: groupOrder.length,
        raw: firstRow,
      },
    },
    lab_request: {
      request_id: primaryLabNumber,
      facility_code: asConcept(SYSTEMS.FACILITY, facilityCode, facilityName, 'facility', 'coded'),
      panel_code: null,
      specimen_code: specimen ? asConcept(SYSTEMS.SPECIMEN, specimen, specimen, 'specimen', 'coded') : null,
      clinical_diagnosis: null,
      taken_datetime: takenDatetime,
      collected_datetime: takenDatetime,
      received_in_lab_datetime: null,
      priority: null,
      source_payload: {
        total_rows: parsed.rows.length,
        total_groups: groupOrder.length,
        columns: parsed.headers,
      },
    },
    lab_results: lab_results,
    isolates: [],
    susceptibility_tests: [],
    _plugin: {
      plugin_name: 'csv-schema',
      plugin_version: '1.0.0',
      source_system: 'CSV tabular lab data',
    },
  };
}

module.exports = { name: 'csv-schema', version: '1.0.0', status: 'active', validate: validate, convert: convert };
