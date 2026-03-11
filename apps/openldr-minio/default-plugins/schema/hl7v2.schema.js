var SYSTEMS = {
  FACILITY: 'HL7_FACILITY',
  TEST: 'LOINC',
  SPECIMEN: 'HL7_SPECIMEN',
  ORG: 'HL7_ORG',
  ABX: 'HL7_ABX',
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

function parseSegments(rawMessage) {
  var text = typeof rawMessage === 'string' ? rawMessage : String(rawMessage);
  var lines = text.split(/\r?\n|\r/).filter(function (l) { return l.trim().length > 0; });
  var segments = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var segType = line.substring(0, 3);
    var fieldSep = '|';
    var fields;
    if (segType === 'MSH') {
      fieldSep = line.charAt(3);
      fields = line.split(fieldSep);
    } else {
      fields = line.split(fieldSep);
    }
    segments.push({ type: segType, fields: fields, raw: line });
  }
  return segments;
}

function getField(segment, index) {
  if (!segment || !segment.fields) return '';
  if (segment.type === 'MSH') {
    if (index === 1) return segment.raw.charAt(3);
    return segment.fields[index - 1] || '';
  }
  return segment.fields[index] || '';
}

function getComponent(field, componentIndex) {
  if (!field) return '';
  var parts = field.split('^');
  return parts[componentIndex - 1] || '';
}

function findSegments(segments, segType) {
  var result = [];
  for (var i = 0; i < segments.length; i++) {
    if (segments[i].type === segType) result.push(segments[i]);
  }
  return result;
}

function findSegment(segments, segType) {
  for (var i = 0; i < segments.length; i++) {
    if (segments[i].type === segType) return segments[i];
  }
  return null;
}

function validate(message) {
  var errors = [];
  if (!message || (typeof message !== 'string' && typeof message !== 'object')) {
    errors.push('Message must be a string or object');
    return { valid: false, reason: 'HL7 v2 validation failed', details: { errors: errors } };
  }

  var text = typeof message === 'string' ? message : (message.raw || message.data || JSON.stringify(message));
  var segments = parseSegments(text);

  var msh = findSegment(segments, 'MSH');
  if (!msh) errors.push('MSH (Message Header) segment is required');

  var pid = findSegment(segments, 'PID');
  if (!pid) errors.push('PID (Patient Identification) segment is required');

  var obxSegments = findSegments(segments, 'OBX');
  var obrSegments = findSegments(segments, 'OBR');
  if (obxSegments.length === 0 && obrSegments.length === 0) {
    errors.push('At least one OBR or OBX segment is required');
  }

  return {
    valid: errors.length === 0,
    reason: errors.length === 0 ? null : 'HL7 v2 validation failed',
    details: errors.length === 0 ? {} : { errors: errors, segment_count: segments.length },
  };
}

function convert(message) {
  var text = typeof message === 'string' ? message : (message.raw || message.data || JSON.stringify(message));
  var segments = parseSegments(text);

  var msh = findSegment(segments, 'MSH');
  var pid = findSegment(segments, 'PID');
  var obrSegments = findSegments(segments, 'OBR');
  var obxSegments = findSegments(segments, 'OBX');

  // MSH fields
  var sendingApp = msh ? getField(msh, 3) : '';
  var sendingFacility = msh ? getField(msh, 4) : '';
  var messageDateTime = msh ? getField(msh, 7) : '';

  // PID fields
  var patientId = pid ? getComponent(getField(pid, 3), 1) : null;
  var patientName = pid ? getField(pid, 5) : '';
  var patientSurname = getComponent(patientName, 1);
  var patientFirstname = getComponent(patientName, 2);
  var patientMiddlename = getComponent(patientName, 3);
  var dob = pid ? getField(pid, 7) : null;
  var sex = pid ? getField(pid, 8) : 'U';
  var address = pid ? getField(pid, 11) : null;

  // First OBR for panel/specimen info
  var firstObr = obrSegments.length > 0 ? obrSegments[0] : null;
  var placerOrderNo = firstObr ? getField(firstObr, 2) : null;
  var fillerOrderNo = firstObr ? getField(firstObr, 3) : null;
  var testCodeField = firstObr ? getField(firstObr, 4) : '';
  var testCode = getComponent(testCodeField, 1);
  var testName = getComponent(testCodeField, 2);
  var specimenField = firstObr ? getField(firstObr, 15) : '';
  var specimenCode = getComponent(specimenField, 1) || specimenField;
  var collectedDateTime = firstObr ? getField(firstObr, 7) : null;

  var requestId = fillerOrderNo || placerOrderNo || patientId;

  var lab_results = [];
  var isolates = [];
  var susceptibility_tests = [];

  for (var i = 0; i < obxSegments.length; i++) {
    var obx = obxSegments[i];
    var valueType = getField(obx, 2);
    var obsIdField = getField(obx, 3);
    var obsCode = getComponent(obsIdField, 1);
    var obsName = getComponent(obsIdField, 2);
    var obsSystem = getComponent(obsIdField, 3);
    var obsValue = getField(obx, 5);
    var obsUnit = getField(obx, 6);
    var obsRange = getField(obx, 7);
    var obsAbnormal = getField(obx, 8);
    var obsStatus = getField(obx, 11);

    lab_results.push({
      source_test_code: testCode || null,
      observation_code: asConcept(SYSTEMS.TEST, obsCode, obsName || obsCode, 'test', 'coded', {
        coding_system: obsSystem || null,
      }),
      result_value: normalizeText(obsValue),
      result_type: valueType === 'NM' ? 1 : 0,
      is_resulted: obsStatus === 'F' || obsStatus === 'C' || Boolean(obsValue),
      raw_result: {
        value_type: valueType,
        value: obsValue,
        unit: obsUnit,
        reference_range: obsRange,
        abnormal_flag: obsAbnormal,
        observation_status: obsStatus,
      },
    });
  }

  return {
    patient: {
      patient_guid: patientId,
      firstname: normalizeText(patientFirstname),
      middlename: normalizeText(patientMiddlename),
      surname: normalizeText(patientSurname),
      sex: normalizeText(sex) || 'U',
      folder_no: patientId,
      address: normalizeText(address),
      patient_data: {
        date_of_birth: dob,
        source_patient_id: patientId,
        raw: text,
      },
    },
    lab_request: {
      request_id: requestId,
      facility_code: asConcept(SYSTEMS.FACILITY, sendingFacility, sendingFacility, 'facility', 'coded', {
        sending_application: sendingApp,
      }),
      panel_code: asConcept(SYSTEMS.TEST, testCode, testName || testCode, 'panel', 'coded'),
      specimen_code: specimenCode ? asConcept(SYSTEMS.SPECIMEN, specimenCode, specimenCode, 'specimen', 'coded') : null,
      clinical_diagnosis: null,
      taken_datetime: collectedDateTime || null,
      collected_datetime: collectedDateTime || null,
      received_in_lab_datetime: null,
      priority: null,
      source_payload: {
        obr_count: obrSegments.length,
        obx_count: obxSegments.length,
        message_datetime: messageDateTime,
      },
    },
    lab_results: lab_results,
    isolates: isolates,
    susceptibility_tests: susceptibility_tests,
    _plugin: {
      plugin_name: 'hl7v2-schema',
      plugin_version: '1.0.0',
      source_system: 'HL7 v2.x (ORU/ORM)',
    },
  };
}

module.exports = { name: 'hl7v2-schema', version: '1.0.0', status: 'active', validate: validate, convert: convert };
