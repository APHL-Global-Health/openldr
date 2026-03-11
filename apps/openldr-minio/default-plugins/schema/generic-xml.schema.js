var SYSTEMS = {
  FACILITY: 'XML_FACILITY',
  TEST: 'XML_TEST',
  SPECIMEN: 'XML_SPECIMEN',
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

// Minimal XML helpers (no require/import in sandbox)
function getAttr(tag, attrName) {
  var re = new RegExp(attrName + '\\s*=\\s*"([^"]*)"');
  var m = tag.match(re);
  return m ? m[1] : null;
}

function getElementContent(xml, tagName) {
  var re = new RegExp('<' + tagName + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tagName + '>', 'i');
  var m = xml.match(re);
  return m ? m[1].trim() : null;
}

function getElementTag(xml, tagName) {
  var re = new RegExp('<' + tagName + '(?:\\s[^>]*)?\\/?>', 'i');
  var m = xml.match(re);
  return m ? m[0] : null;
}

function findAllElements(xml, tagName) {
  var results = [];
  // Self-closing
  var re1 = new RegExp('<' + tagName + '(?:\\s[^>]*)?\\/>', 'gi');
  var m;
  while ((m = re1.exec(xml)) !== null) {
    results.push({ tag: m[0], content: '', selfClosing: true });
  }
  // With content
  var re2 = new RegExp('<' + tagName + '(?:\\s[^>]*)?>[\\s\\S]*?<\\/' + tagName + '>', 'gi');
  while ((m = re2.exec(xml)) !== null) {
    results.push({ tag: m[0], content: m[0], selfClosing: false });
  }
  return results;
}

function validate(message) {
  var errors = [];
  var text = typeof message === 'string' ? message : String(message);

  if (!text || text.trim().length === 0) {
    errors.push('XML content is empty');
    return { valid: false, reason: 'Generic XML validation failed', details: { errors: errors } };
  }

  // Check for basic XML structure
  if (text.indexOf('<') < 0 || text.indexOf('>') < 0) {
    errors.push('Content does not appear to be valid XML');
    return { valid: false, reason: 'Generic XML validation failed', details: { errors: errors } };
  }

  // Look for facility info
  var hasFacility = text.indexOf('<Facility') >= 0 || text.indexOf('<facility') >= 0 ||
    text.indexOf('FacilityCode') >= 0 || text.indexOf('facility_code') >= 0;
  if (!hasFacility) errors.push('Facility element or attribute is required');

  // Look for lab number
  var hasLabNumber = text.indexOf('<LabNumber') >= 0 || text.indexOf('<lab_number') >= 0 ||
    text.indexOf('<LabNo') >= 0 || text.indexOf('<AccessionNumber') >= 0 ||
    text.indexOf('LabNumber') >= 0;
  if (!hasLabNumber) errors.push('LabNumber element is required');

  // Look for results
  var hasResults = text.indexOf('<Result') >= 0 || text.indexOf('<result') >= 0 ||
    text.indexOf('<Test') >= 0 || text.indexOf('<Observation') >= 0;
  if (!hasResults) errors.push('Results or Test elements are required');

  return {
    valid: errors.length === 0,
    reason: errors.length === 0 ? null : 'Generic XML validation failed',
    details: errors.length === 0 ? {} : { errors: errors },
  };
}

function convert(message) {
  var xml = typeof message === 'string' ? message : String(message);

  // Facility
  var facilityTag = getElementTag(xml, 'Facility') || getElementTag(xml, 'facility') || '';
  var facilityCode = getAttr(facilityTag, 'Code') || getAttr(facilityTag, 'code') ||
    getElementContent(xml, 'FacilityCode') || getElementContent(xml, 'facility_code') || null;
  var facilityName = getAttr(facilityTag, 'Name') || getAttr(facilityTag, 'name') ||
    getElementContent(xml, 'FacilityName') || getElementContent(xml, 'facility_name') || facilityCode;

  // Lab number
  var labNumber = getElementContent(xml, 'LabNumber') || getElementContent(xml, 'lab_number') ||
    getElementContent(xml, 'LabNo') || getElementContent(xml, 'AccessionNumber') || null;

  // Patient
  var patientTag = getElementTag(xml, 'Patient') || getElementTag(xml, 'patient') || '';
  var firstName = getAttr(patientTag, 'FirstName') || getAttr(patientTag, 'firstname') ||
    getElementContent(xml, 'FirstName') || getElementContent(xml, 'PatientFirstName') || null;
  var lastName = getAttr(patientTag, 'LastName') || getAttr(patientTag, 'lastname') ||
    getAttr(patientTag, 'Surname') || getElementContent(xml, 'LastName') ||
    getElementContent(xml, 'PatientSurname') || null;
  var sex = getAttr(patientTag, 'Sex') || getAttr(patientTag, 'Gender') ||
    getElementContent(xml, 'Sex') || getElementContent(xml, 'Gender') || 'U';
  var folderNo = getAttr(patientTag, 'FolderNo') || getAttr(patientTag, 'PatientId') ||
    getElementContent(xml, 'FolderNo') || getElementContent(xml, 'PatientId') || null;

  // Specimen
  var specimenTag = getElementTag(xml, 'Specimen') || getElementTag(xml, 'specimen') || '';
  var specimenCode = getAttr(specimenTag, 'Code') || getAttr(specimenTag, 'code') ||
    getElementContent(xml, 'Specimen') || getElementContent(xml, 'SpecimenType') || null;
  var specimenName = getAttr(specimenTag, 'Name') || getAttr(specimenTag, 'name') || specimenCode;

  // Dates
  var collectedDatetime = getElementContent(xml, 'CollectedDateTime') ||
    getElementContent(xml, 'collected_datetime') || getElementContent(xml, 'CollectionDate') || null;

  // Results
  var resultElements = findAllElements(xml, 'Result');
  if (resultElements.length === 0) resultElements = findAllElements(xml, 'result');
  if (resultElements.length === 0) resultElements = findAllElements(xml, 'Test');

  var lab_results = [];
  for (var i = 0; i < resultElements.length; i++) {
    var el = resultElements[i];
    var tagStr = el.tag;
    var code = getAttr(tagStr, 'Code') || getAttr(tagStr, 'code') || null;
    var name = getAttr(tagStr, 'Name') || getAttr(tagStr, 'name') || getAttr(tagStr, 'Description') || code;
    var value = getAttr(tagStr, 'Value') || getAttr(tagStr, 'value') || null;
    var unit = getAttr(tagStr, 'Unit') || getAttr(tagStr, 'unit') || null;
    var range = getAttr(tagStr, 'ReferenceRange') || getAttr(tagStr, 'reference_range') ||
      getAttr(tagStr, 'NormalRange') || null;

    if (!code && !el.selfClosing) {
      code = getElementContent(tagStr, 'Code') || getElementContent(tagStr, 'code');
      name = name || getElementContent(tagStr, 'Name') || getElementContent(tagStr, 'name');
      value = value || getElementContent(tagStr, 'Value') || getElementContent(tagStr, 'value');
    }

    if (code) {
      lab_results.push({
        source_test_code: normalizeCode(code),
        observation_code: asConcept(SYSTEMS.TEST, code, name, 'test', 'coded', {
          unit: normalizeText(unit),
          reference_range: normalizeText(range),
        }),
        result_value: normalizeText(value),
        result_type: value && !isNaN(Number(value)) ? 1 : 0,
        is_resulted: Boolean(value && String(value).trim().length > 0),
        raw_result: { xml_fragment: tagStr },
      });
    }
  }

  return {
    patient: {
      patient_guid: labNumber,
      firstname: normalizeText(firstName),
      middlename: null,
      surname: normalizeText(lastName),
      sex: normalizeText(sex) || 'U',
      folder_no: normalizeText(folderNo),
      address: null,
      patient_data: { raw_xml: xml },
    },
    lab_request: {
      request_id: labNumber,
      facility_code: asConcept(SYSTEMS.FACILITY, facilityCode, facilityName, 'facility', 'coded'),
      panel_code: null,
      specimen_code: specimenCode ? asConcept(SYSTEMS.SPECIMEN, specimenCode, specimenName, 'specimen', 'coded') : null,
      clinical_diagnosis: null,
      taken_datetime: collectedDatetime,
      collected_datetime: collectedDatetime,
      received_in_lab_datetime: null,
      priority: null,
      source_payload: { result_count: lab_results.length },
    },
    lab_results: lab_results,
    isolates: [],
    susceptibility_tests: [],
    _plugin: {
      plugin_name: 'generic-xml-schema',
      plugin_version: '1.0.0',
      source_system: 'Generic lab XML',
    },
  };
}

module.exports = { name: 'generic-xml-schema', version: '1.0.0', status: 'active', validate: validate, convert: convert };
