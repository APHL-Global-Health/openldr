var SYSTEMS = {
  FACILITY: 'HL7_FAC',
  TEST: 'HL7_TEST',
  SPECIMEN: 'HL7_SPEC',
  ORG: 'HL7_ORG',
  ABX: 'HL7_ABX',
  // Standard FHIR coding-system identifiers — picked when the bundle
  // declares the corresponding `system` URL on a coding so concepts
  // land under the right canonical bucket in OpenLDR's terminology
  // table instead of all collapsing into HL7_TEST/HL7_SPEC.
  LOINC: 'LOINC',
  SNOMED: 'SNOMED',
  ICD10: 'ICD10',
  RXNORM: 'RXNORM',
  UCUM: 'UCUM',
};

// Map a FHIR coding.system URL to an OpenLDR system_id. Returns the
// caller-supplied fallback when the URL is missing or unrecognised, so
// existing call sites that pass HL7_TEST / HL7_SPEC keep their default
// behaviour for codes without a declared system.
function systemIdFor(url, fallback) {
  if (!url) return fallback;
  var s = String(url).toLowerCase();
  if (s.indexOf('loinc.org') >= 0) return SYSTEMS.LOINC;
  if (s.indexOf('snomed.info/sct') >= 0) return SYSTEMS.SNOMED;
  if (s.indexOf('hl7.org/fhir/sid/icd-10') >= 0) return SYSTEMS.ICD10;
  if (s.indexOf('rxnorm') >= 0) return SYSTEMS.RXNORM;
  if (s.indexOf('unitsofmeasure.org') >= 0) return SYSTEMS.UCUM;
  // HL7 v2 specimen-type table 0487 → keep under HL7_SPEC bucket
  if (s.indexOf('codesystem/v2-0487') >= 0) return SYSTEMS.SPECIMEN;
  return fallback;
}

// Build a concept directly from a FHIR coding object, picking the
// system_id from the coding.system URL when present.
function conceptFromCoding(coding, fallbackSystemId, conceptClass, datatype) {
  if (!coding) return null;
  return asConcept(
    systemIdFor(coding.system, fallbackSystemId),
    coding.code,
    coding.display || coding.code,
    conceptClass,
    datatype || 'coded',
    coding.system ? { source_system_url: coding.system } : null
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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
// HL7 v2 helpers
// ---------------------------------------------------------------------------

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

function parseHL7v2Message(text) {
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
      result_type: valueType === 'NM' ? 'NM' : valueType || null,
      numeric_value: valueType === 'NM' && obsValue && !isNaN(Number(obsValue)) ? Number(obsValue) : null,
      coded_value: valueType === 'CE' || valueType === 'CWE' ? getComponent(obsValue, 1) : null,
      text_value: valueType === 'TX' || valueType === 'ST' ? obsValue : null,
      numeric_units: normalizeText(obsUnit) || null,
      abnormal_flag: normalizeText(obsAbnormal) || null,
      rpt_units: normalizeText(obsUnit) || null,
      rpt_flag: normalizeText(obsAbnormal) || null,
      rpt_range: normalizeText(obsRange) || null,
      result_timestamp: null,
      isolate_index: null,
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
      date_of_birth: normalizeText(dob),
      phone: null,
      email: null,
      national_id: null,
      address: normalizeText(address),
      patient_data: {
        date_of_birth: dob,
        source_patient_id: patientId,
      },
    },
    lab_request: {
      request_id: requestId,
      facility_code: asConcept(SYSTEMS.FACILITY, sendingFacility, sendingFacility, 'facility', 'coded', {
        sending_application: sendingApp,
      }),
      panel_code: asConcept(SYSTEMS.TEST, testCode, testName || testCode, 'panel', 'coded'),
      specimen_code: specimenCode ? asConcept(SYSTEMS.SPECIMEN, specimenCode, specimenCode, 'specimen', 'coded') : null,
      taken_datetime: collectedDateTime || null,
      collected_datetime: collectedDateTime || null,
      received_at: null,
      registered_at: null,
      analysis_at: null,
      authorised_at: null,
      clinical_info: null,
      icd10_codes: null,
      therapy: null,
      priority: null,
      age_years: null,
      age_days: null,
      sex: normalizeText(sex) || 'U',
      patient_class: null,
      section_code: null,
      result_status: null,
      requesting_facility: null,
      testing_facility: normalizeText(sendingFacility),
      requesting_doctor: null,
      tested_by: null,
      authorised_by: null,
      source_payload: {
        obr_count: obrSegments.length,
        obx_count: obxSegments.length,
        message_datetime: messageDateTime,
      },
    },
    lab_results: lab_results,
    isolates: [],
    susceptibility_tests: [],
  };
}

// ---------------------------------------------------------------------------
// FHIR JSON helpers
// ---------------------------------------------------------------------------

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

// Map FHIR/HL7 status strings to single-character DB codes
function mapResultStatus(status) {
  if (!status) return null;
  var s = String(status).trim().toLowerCase();
  if (s === 'f' || s === 'final') return 'F';
  if (s === 'p' || s === 'preliminary') return 'P';
  if (s === 'c' || s === 'corrected' || s === 'amended') return 'C';
  if (s === 'x' || s === 'cancelled') return 'X';
  if (s === 'r' || s === 'registered') return 'R';
  if (s === 'i' || s === 'partial') return 'I';
  // Single char already — pass through uppercase
  if (s.length === 1) return s.toUpperCase();
  // Unknown — take first character
  return s.charAt(0).toUpperCase();
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

// Pull the first telecom matching `kind` (e.g. 'phone', 'email').
function patientTelecom(patient, kind) {
  if (!patient || !Array.isArray(patient.telecom)) return null;
  for (var i = 0; i < patient.telecom.length; i++) {
    var t = patient.telecom[i];
    if (t && t.system === kind && t.value) return normalizeText(t.value);
  }
  return null;
}

// First Address's text, or a synthesised line/city/country fallback.
function patientAddressText(patient) {
  if (!patient || !Array.isArray(patient.address) || patient.address.length === 0) return null;
  var addr = patient.address[0];
  if (!addr) return null;
  if (addr.text) return normalizeText(addr.text);
  var parts = [];
  if (Array.isArray(addr.line)) {
    for (var i = 0; i < addr.line.length; i++) if (addr.line[i]) parts.push(addr.line[i]);
  }
  if (addr.city) parts.push(addr.city);
  if (addr.district) parts.push(addr.district);
  if (addr.state) parts.push(addr.state);
  if (addr.postalCode) parts.push(addr.postalCode);
  if (addr.country) parts.push(addr.country);
  return parts.length > 0 ? normalizeText(parts.join(', ')) : null;
}

// Identifier whose system or use suggests a national / government ID.
// FHIR doesn't standardise a single URL for this — recognise common
// patterns (NN, SSN, "national-id" in the URL) and ignore organisation
// or MRN-flavoured identifiers.
function patientNationalId(patient) {
  if (!patient || !Array.isArray(patient.identifier)) return null;
  for (var i = 0; i < patient.identifier.length; i++) {
    var id = patient.identifier[i];
    if (!id || !id.value) continue;
    var sys = id.system ? String(id.system).toLowerCase() : '';
    var typeCode = id.type && id.type.coding && id.type.coding[0] && id.type.coding[0].code
      ? String(id.type.coding[0].code).toUpperCase() : '';
    if (typeCode === 'NI' || typeCode === 'SS' || typeCode === 'NN' || typeCode === 'SSN') {
      return normalizeText(id.value);
    }
    if (sys.indexOf('national-id') >= 0 || sys.indexOf('nationalid') >= 0
        || sys.indexOf('us-ssn') >= 0 || sys.indexOf('/sid/') >= 0 && sys.indexOf('national') >= 0) {
      return normalizeText(id.value);
    }
  }
  return null;
}

// Extract a folder_no — the first identifier that isn't the
// internal/global patient guid we're already exposing as patient_guid.
// Falls back to identifier[0] for backwards-compat with callers that
// only emit one identifier.
function patientFolderNo(patient) {
  if (!patient || !Array.isArray(patient.identifier) || patient.identifier.length === 0) return null;
  for (var i = 0; i < patient.identifier.length; i++) {
    var id = patient.identifier[i];
    if (!id || !id.value) continue;
    var sys = id.system ? String(id.system).toLowerCase() : '';
    // Skip the global patient guid; treat anything else as folder_no.
    if (sys.indexOf('patient-id') >= 0 && sys.indexOf('national') < 0) continue;
    if (sys.indexOf('patient-guid') >= 0) continue;
    return normalizeText(id.value);
  }
  return normalizeText(patient.identifier[0].value);
}

// Compute age in completed years from a YYYY-MM-DD birthDate against an
// anchor (the report timestamp, or now). Returns null when birthDate is
// missing or unparseable.
function ageYearsFrom(birthDate, anchorIso) {
  if (!birthDate) return null;
  var b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  var anchor = anchorIso ? new Date(anchorIso) : new Date();
  if (isNaN(anchor.getTime())) anchor = new Date();
  var years = anchor.getFullYear() - b.getFullYear();
  var m = anchor.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && anchor.getDate() < b.getDate())) years--;
  return years >= 0 && years < 150 ? years : null;
}

// Find every ServiceRequest the report cites in basedOn[]; falls back to
// every ServiceRequest in the bundle when basedOn isn't populated.
function findServiceRequests(bundle, report) {
  if (!bundle) return [];
  var refs = [];
  if (report && Array.isArray(report.basedOn)) {
    for (var i = 0; i < report.basedOn.length; i++) {
      if (report.basedOn[i] && report.basedOn[i].reference) refs.push(report.basedOn[i].reference);
    }
  }
  if (refs.length === 0) {
    return findResourcesByType(bundle, 'ServiceRequest');
  }
  var found = [];
  for (var j = 0; j < refs.length; j++) {
    var sr = findResourceById(bundle, refs[j]);
    if (sr) found.push(sr);
  }
  return found;
}

// Aggregate ServiceRequest fields into the bits lab_request needs.
function summariseServiceRequests(srs) {
  var out = { priority: null, clinical_info: null, requesting_doctor: null, icd10_codes: null };
  if (!Array.isArray(srs) || srs.length === 0) return out;
  var notes = [];
  var icds = [];
  for (var i = 0; i < srs.length; i++) {
    var sr = srs[i];
    if (!sr) continue;
    if (!out.priority && sr.priority) out.priority = String(sr.priority).charAt(0).toUpperCase();
    if (Array.isArray(sr.note)) {
      for (var j = 0; j < sr.note.length; j++) {
        var n = sr.note[j];
        if (n && n.text) notes.push(normalizeText(n.text));
      }
    }
    if (!out.requesting_doctor && sr.requester) {
      out.requesting_doctor = normalizeText(sr.requester.display || (sr.requester.identifier && sr.requester.identifier.value) || null);
    }
    if (Array.isArray(sr.reasonCode)) {
      for (var k = 0; k < sr.reasonCode.length; k++) {
        var rc = getCoding(sr.reasonCode[k]);
        if (rc && rc.code && rc.system && String(rc.system).toLowerCase().indexOf('icd-10') >= 0) {
          icds.push(rc.code);
        }
      }
    }
  }
  if (notes.length > 0) out.clinical_info = notes.join(' | ');
  if (icds.length > 0) out.icd10_codes = icds.join(',');
  return out;
}

// Pull the first non-empty Observation.performer display across all
// observations — best-effort attribution for tested_by / authorised_by
// when the bundle doesn't carry richer Provenance resources.
function firstPerformerDisplay(observations) {
  if (!Array.isArray(observations)) return null;
  for (var i = 0; i < observations.length; i++) {
    var perfs = observations[i] && observations[i].performer;
    if (!Array.isArray(perfs)) continue;
    for (var j = 0; j < perfs.length; j++) {
      var p = perfs[j];
      if (!p) continue;
      var v = p.display || (p.identifier && p.identifier.value) || null;
      if (v) return normalizeText(v);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Microbiology — culture / isolate / susceptibility resolvers
// ---------------------------------------------------------------------------
//
// Corlix (and the FHIR R4 micro convention more broadly) encode micro
// results as a tree of Observations linked by `hasMember`:
//
//   DiagnosticReport.result[] -> Observation (culture)
//                                   |
//                                   +- hasMember[] -> Observation (isolate)
//                                                        |
//                                                        +- hasMember[] -> Observation (susceptibility)
//
// We walk that tree once per DiagnosticReport and emit `isolates[]` +
// `susceptibility_tests[]` rows the rest of OpenLDR's pipeline expects.
// Cultures themselves remain in lab_results (they're still
// Observations); the isolates table just provides the structured
// per-isolate / per-antibiotic projection.
//
// The resolver tolerates two shapes:
//   - Full chain (culture -> isolate -> AST) when basedOn'd labs emit
//     an explicit culture wrapper.
//   - Two-tier (isolate -> AST) when the bundle skips the culture
//     parent and lists isolates directly under the report.
// Detection is depth-based: an Observation whose hasMember[] children
// themselves carry hasMember[] is treated as a culture; otherwise as an
// isolate.

function getOrganismCoding(obs) {
  if (!obs) return null;
  if (obs.valueCodeableConcept) return getCoding(obs.valueCodeableConcept);
  return null;
}

// Pull S/I/R from valueCodeableConcept (coding.code or display),
// interpretation[] (FHIR R4 standard), or valueString fallback.
function getSusceptibilityValue(obs) {
  if (!obs) return null;
  if (obs.valueCodeableConcept) {
    var c = getCoding(obs.valueCodeableConcept);
    if (c) {
      var code = String(c.code || '').toUpperCase();
      if (code === 'S' || code === 'I' || code === 'R') return code;
      var disp = String(c.display || '').toLowerCase();
      if (disp.indexOf('susceptible') >= 0) return 'S';
      if (disp.indexOf('intermediate') >= 0) return 'I';
      if (disp.indexOf('resistant') >= 0) return 'R';
    }
  }
  if (Array.isArray(obs.interpretation) && obs.interpretation.length > 0) {
    var ic = getCoding(obs.interpretation[0]);
    if (ic) {
      var c2 = String(ic.code || '').toUpperCase();
      if (c2 === 'S' || c2 === 'I' || c2 === 'R') return c2;
    }
  }
  if (obs.valueString) {
    var s = String(obs.valueString).trim().toUpperCase();
    if (s === 'S' || s === 'I' || s === 'R') return s;
  }
  return null;
}

// Find the first MIC- or zone-diameter-shaped component on an AST
// observation. Returns method + raw + numeric + unit.
function getQuantitativeFromComponents(obs) {
  var out = { method: null, raw: null, numeric: null, unit: null };
  if (!obs || !Array.isArray(obs.component) || obs.component.length === 0) return out;
  for (var i = 0; i < obs.component.length; i++) {
    var c = obs.component[i];
    if (!c || !c.valueQuantity) continue;
    var coding = c.code ? getCoding(c.code) : null;
    var label = coding ? String(coding.display || coding.code || '').toLowerCase() : '';
    var method = null;
    if (label.indexOf('mic') >= 0 || label.indexOf('minimum inhibitory') >= 0) method = 'MIC';
    else if (label.indexOf('zone') >= 0 || label.indexOf('disk') >= 0 || label.indexOf('disc') >= 0) method = 'DISK';
    var v = c.valueQuantity.value;
    var raw = c.valueQuantity.comparator
      ? c.valueQuantity.comparator + (v != null ? String(v) : '')
      : (v != null ? String(v) : null);
    out.method = method;
    out.raw = raw;
    out.numeric = typeof v === 'number' ? v : null;
    out.unit = c.valueQuantity.unit || null;
    return out;
  }
  return out;
}

// Map Observation.method coding to a method label (DISK / MIC / ETEST).
function getTestMethod(obs) {
  if (!obs || !obs.method) return null;
  var c = getCoding(obs.method);
  if (!c) return null;
  var label = String(c.display || c.code || '').toLowerCase();
  if (label.indexOf('mic') >= 0 || label.indexOf('minimum inhibitory') >= 0) return 'MIC';
  if (label.indexOf('etest') >= 0 || label.indexOf('e-test') >= 0) return 'ETEST';
  if (label.indexOf('disk') >= 0 || label.indexOf('disc') >= 0) return 'DISK';
  if (label.indexOf('gradient') >= 0) return 'ETEST';
  return null;
}

// CLSI / EUCAST guideline + version. Read from a known FHIR extension
// when present, otherwise derive from any free-text note.
function getGuidelineMeta(obs) {
  var out = { guideline: null, guideline_version: null };
  if (!obs) return out;
  if (Array.isArray(obs.extension)) {
    for (var i = 0; i < obs.extension.length; i++) {
      var ext = obs.extension[i];
      if (!ext || !ext.url) continue;
      var url = String(ext.url).toLowerCase();
      if (url.indexOf('guideline') >= 0 && ext.valueString) {
        out.guideline = normalizeText(ext.valueString);
      }
      if (url.indexOf('guideline-version') >= 0 && ext.valueString) {
        out.guideline_version = normalizeText(ext.valueString);
      }
    }
  }
  if (!out.guideline && Array.isArray(obs.note)) {
    for (var j = 0; j < obs.note.length; j++) {
      var n = obs.note[j];
      if (!n || !n.text) continue;
      var t = String(n.text).toUpperCase();
      if (t.indexOf('CLSI') >= 0) { out.guideline = 'CLSI'; break; }
      if (t.indexOf('EUCAST') >= 0) { out.guideline = 'EUCAST'; break; }
    }
  }
  return out;
}

// Resolve a hasMember[] reference list into the actual child Observations.
function resolveHasMember(obs, bundle) {
  if (!obs || !Array.isArray(obs.hasMember)) return [];
  var children = [];
  for (var i = 0; i < obs.hasMember.length; i++) {
    var ref = obs.hasMember[i];
    if (!ref) continue;
    var child = ref.resource || (bundle ? findResourceById(bundle, ref.reference || '') : null);
    if (child) children.push(child);
  }
  return children;
}

function buildIsolateRow(isolateObs, isolateIndex, cultureObs, patient) {
  var organism = getOrganismCoding(isolateObs);
  var cultureCoding = cultureObs ? getCoding(cultureObs.code) : null;
  return {
    isolate_index: isolateIndex,
    source_test_code: cultureCoding ? cultureCoding.code : null,
    organism_code: organism ? conceptFromCoding(organism, SYSTEMS.ORG, 'organism') : null,
    organism_type: null,
    isolate_number: String(isolateIndex),
    serotype: null,
    patient_age_days: null,
    patient_sex: patient && patient.gender ? patient.gender.charAt(0).toUpperCase() : null,
    ward: null,
    ward_type: null,
    origin: null,
    beta_lactamase: null,
    esbl: null,
    carbapenemase: null,
    mrsa_screen: null,
    inducible_clinda: null,
    custom_fields: null,
    raw_result: isolateObs,
  };
}

function buildSusceptibilityRow(astObs, isolateIndex) {
  var antibiotic = astObs && astObs.code ? getCoding(astObs.code) : null;
  var sir = getSusceptibilityValue(astObs);
  var quant = getQuantitativeFromComponents(astObs);
  var method = getTestMethod(astObs) || quant.method;
  var guide = getGuidelineMeta(astObs);
  return {
    isolate_index: isolateIndex,
    source_test_code: 'SENS',
    antibiotic_code: antibiotic ? conceptFromCoding(antibiotic, SYSTEMS.ABX, 'antibiotic') : null,
    test_method: method,
    disk_potency: null,
    result_raw: quant.raw,
    result_numeric: quant.numeric,
    susceptibility_value: sir,
    quantitative_value: quant.raw,
    guideline: guide.guideline,
    guideline_version: guide.guideline_version,
    raw_result: astObs,
  };
}

// Walk every top-level Observation; if it has a hasMember[] chain,
// project the chain into isolates[] + susceptibility_tests[].
function findMicroResults(topObservations, bundle, patient) {
  // Returns the structured micro projection plus the supporting metadata
  // the caller needs to round-trip every Observation in the hasMember
  // tree into lab_results:
  //
  //   isolateIndexById     {obsId → idx}  for isolates AND their AST kids
  //   descendantObservations [obs]        every Observation reachable via
  //                                       hasMember[] but NOT in
  //                                       topObservations — the caller
  //                                       emits these as extra lab_result
  //                                       rows (tagged with isolate_index)
  //                                       so users can search lab_results
  //                                       generically and still find AST
  //                                       hits.
  var isolates = [];
  var susceptibility_tests = [];
  var isolateIndexById = {};
  var descendantObservations = [];
  if (!Array.isArray(topObservations)) {
    return {
      isolates: isolates,
      susceptibility_tests: susceptibility_tests,
      isolateIndexById: isolateIndexById,
      descendantObservations: descendantObservations,
    };
  }

  var nextIsolateIndex = 1;

  function tagIsolateIndex(obs, idx) {
    if (obs && obs.id != null) isolateIndexById[obs.id] = idx;
  }

  for (var i = 0; i < topObservations.length; i++) {
    var top = topObservations[i];
    var children = resolveHasMember(top, bundle);
    if (children.length === 0) continue;

    // Depth detection: if at least one child has its own hasMember[]
    // the top is a culture wrapper; else the top is itself an isolate.
    var firstWithMembers = false;
    for (var f = 0; f < children.length; f++) {
      if (Array.isArray(children[f].hasMember) && children[f].hasMember.length > 0) {
        firstWithMembers = true;
        break;
      }
    }

    if (firstWithMembers) {
      // Culture -> isolate -> AST. The culture is a top-level
      // Observation, so it'll already be in lab_results — no need to
      // add it again here. The isolates and ASTs are descendants and
      // must be appended to descendantObservations.
      for (var k = 0; k < children.length; k++) {
        var isolateObs = children[k];
        var idx = nextIsolateIndex++;
        isolates.push(buildIsolateRow(isolateObs, idx, top, patient));
        tagIsolateIndex(isolateObs, idx);
        descendantObservations.push(isolateObs);
        var astChildren = resolveHasMember(isolateObs, bundle);
        for (var m = 0; m < astChildren.length; m++) {
          susceptibility_tests.push(buildSusceptibilityRow(astChildren[m], idx));
          tagIsolateIndex(astChildren[m], idx);
          descendantObservations.push(astChildren[m]);
        }
      }
    } else {
      // Two-tier: top is the isolate, children are AST. The isolate
      // is already in topObservations (and therefore in lab_results)
      // — just tag it with the index. The ASTs are descendants.
      var idx2 = nextIsolateIndex++;
      isolates.push(buildIsolateRow(top, idx2, null, patient));
      tagIsolateIndex(top, idx2);
      for (var n = 0; n < children.length; n++) {
        susceptibility_tests.push(buildSusceptibilityRow(children[n], idx2));
        tagIsolateIndex(children[n], idx2);
        descendantObservations.push(children[n]);
      }
    }
  }

  return {
    isolates: isolates,
    susceptibility_tests: susceptibility_tests,
    isolateIndexById: isolateIndexById,
    descendantObservations: descendantObservations,
  };
}

// Build one lab_result row from a FHIR Observation. Extracted so the
// top-level loop and the descendant loop in convertDiagnosticReport
// share the exact same shape.
function buildLabResultRow(obs, reportCoding, isolateIndex) {
  var obsCoding = getCoding(obs.code);
  var code = obsCoding ? obsCoding.code : null;
  var display = obsCoding ? (obsCoding.display || code) : null;
  var value = getObservationValue(obs);
  var isNumeric = Boolean(obs.valueQuantity);
  var valCoding = obs.valueCodeableConcept ? getCoding(obs.valueCodeableConcept) : null;
  return {
    source_test_code: reportCoding ? reportCoding.code : null,
    // Default to 1: a FHIR Observation represents a single result with
    // no native sub-ID concept (HL7 v2 OBX-4 sub-IDs collapse to 1
    // when round-tripped through FHIR). Keeps the column non-null so
    // downstream queries that group by (set_id, sub_id) work without
    // having to coalesce.
    obx_sub_id: 1,
    observation_code: obsCoding
      ? conceptFromCoding(obsCoding, SYSTEMS.TEST, 'test')
      : asConcept(SYSTEMS.TEST, code, display, 'test', 'coded'),
    result_value: value,
    result_type: isNumeric ? 'NM' : (valCoding ? 'CE' : 'ST'),
    numeric_value: isNumeric && obs.valueQuantity ? obs.valueQuantity.value : null,
    coded_value: valCoding ? valCoding.code || null : null,
    text_value: obs.valueString || null,
    numeric_units: isNumeric && obs.valueQuantity ? (obs.valueQuantity.unit || null) : null,
    abnormal_flag: null,
    rpt_units: isNumeric && obs.valueQuantity ? (obs.valueQuantity.unit || null) : null,
    rpt_flag: null,
    rpt_range: null,
    result_timestamp: obs.effectiveDateTime || obs.issued || null,
    isolate_index: isolateIndex == null ? null : isolateIndex,
    is_resulted: value !== null,
    raw_result: obs,
  };
}

function convertDiagnosticReport(report, bundle) {
  var patient = null;
  if (report.subject && report.subject.reference) {
    patient = bundle ? findResourceById(bundle, report.subject.reference) : null;
  }

  var patientName = patient && Array.isArray(patient.name) && patient.name.length > 0 ? patient.name[0] : null;

  var facilityDisplay = null;
  var facilityCode = null;
  if (Array.isArray(report.performer) && report.performer.length > 0) {
    var performer = report.performer[0];
    facilityDisplay = performer.display || null;
    facilityCode = (performer.identifier && performer.identifier.value) || facilityDisplay;
  }

  var reportCoding = getCoding(report.code);
  var requestId = report.id || (patient && patient.id) || null;

  var specimenResource = null;
  var specimenCoding = null;
  var specimenDisplayFromRef = null;
  if (Array.isArray(report.specimen) && report.specimen.length > 0) {
    var specimenRef = report.specimen[0];
    specimenResource = bundle ? findResourceById(bundle, specimenRef.reference || '') : null;
    if (specimenResource && specimenResource.type) {
      specimenCoding = getCoding(specimenResource.type);
    }
    if (specimenRef.display) specimenDisplayFromRef = specimenRef.display;
  }
  // specimen_code prefers a real coding (system-aware concept) and only
  // falls back to a free-text label when no coding is present. We
  // deliberately don't fall through to specimenRef.reference any more —
  // those reference strings (Specimen/<uuid>) created junk concepts on
  // every push.
  var specimenConcept = null;
  if (specimenCoding) {
    specimenConcept = conceptFromCoding(specimenCoding, SYSTEMS.SPECIMEN, 'specimen');
  } else if (specimenResource && specimenResource.type && specimenResource.type.text) {
    specimenConcept = asConcept(SYSTEMS.SPECIMEN, specimenResource.type.text, specimenResource.type.text, 'specimen', 'coded');
  } else if (specimenDisplayFromRef) {
    specimenConcept = asConcept(SYSTEMS.SPECIMEN, specimenDisplayFromRef, specimenDisplayFromRef, 'specimen', 'coded');
  }

  var observations = [];
  if (Array.isArray(report.result)) {
    for (var i = 0; i < report.result.length; i++) {
      var resultRef = report.result[i];
      var obs = resultRef.resource || (bundle ? findResourceById(bundle, resultRef.reference || '') : null);
      if (obs) observations.push(obs);
    }
  }

  // Run the micro projection up front so the lab_results loop can
  // tag isolate observations with isolate_index, then append rows for
  // every AST descendant (so lab_results stays a complete index of
  // every observation in the bundle even when a structured
  // susceptibility_tests row also exists).
  var micro = findMicroResults(observations, bundle, patient);

  var lab_results = [];
  for (var j = 0; j < observations.length; j++) {
    var obsTop = observations[j];
    var idxTop = obsTop && obsTop.id != null && micro.isolateIndexById[obsTop.id] != null
      ? micro.isolateIndexById[obsTop.id]
      : null;
    lab_results.push(buildLabResultRow(obsTop, reportCoding, idxTop));
  }
  for (var dd = 0; dd < micro.descendantObservations.length; dd++) {
    var dobs = micro.descendantObservations[dd];
    var idxD = dobs && dobs.id != null && micro.isolateIndexById[dobs.id] != null
      ? micro.isolateIndexById[dobs.id]
      : null;
    lab_results.push(buildLabResultRow(dobs, reportCoding, idxD));
  }

  // Pull ServiceRequest context (priority, clinical info, requester).
  var srSummary = summariseServiceRequests(findServiceRequests(bundle, report));

  // Best-effort timestamps. The plugin used to hardcode all these to
  // null; we now read the most common FHIR fields. Deployments that
  // need richer provenance can still override via a downstream mapper.
  var collectedDateTime = null;
  var receivedAt = null;
  if (specimenResource) {
    if (specimenResource.collection && specimenResource.collection.collectedDateTime) {
      collectedDateTime = specimenResource.collection.collectedDateTime;
    }
    if (specimenResource.receivedTime) receivedAt = specimenResource.receivedTime;
  }
  var authorisedAt = report.issued || null;
  var takenDateTime = report.effectiveDateTime || collectedDateTime || null;

  var sex = patient ? (patient.gender ? patient.gender.charAt(0).toUpperCase() : 'U') : 'U';
  var anchorIso = report.issued || report.effectiveDateTime || null;
  var ageYears = ageYearsFrom(patient && patient.birthDate, anchorIso);

  var testedBy = firstPerformerDisplay(observations);

  return {
    patient: {
      patient_guid: patient ? patient.id : requestId,
      firstname: patientName ? (Array.isArray(patientName.given) ? patientName.given[0] : null) : null,
      middlename: patientName ? (Array.isArray(patientName.given) && patientName.given.length > 1 ? patientName.given[1] : null) : null,
      surname: patientName ? patientName.family : null,
      sex: sex,
      folder_no: patientFolderNo(patient),
      date_of_birth: patient ? patient.birthDate : null,
      phone: patientTelecom(patient, 'phone'),
      email: patientTelecom(patient, 'email'),
      national_id: patientNationalId(patient),
      address: patientAddressText(patient),
      patient_data: { raw: patient || {} },
    },
    lab_request: {
      request_id: requestId,
      facility_code: asConcept(SYSTEMS.FACILITY, facilityCode, facilityDisplay, 'facility', 'coded'),
      panel_code: reportCoding
        ? conceptFromCoding(reportCoding, SYSTEMS.TEST, 'panel')
        : null,
      specimen_code: specimenConcept,
      taken_datetime: takenDateTime,
      collected_datetime: collectedDateTime,
      received_at: receivedAt,
      registered_at: null,
      analysis_at: null,
      authorised_at: authorisedAt,
      clinical_info: srSummary.clinical_info,
      icd10_codes: srSummary.icd10_codes,
      therapy: null,
      priority: srSummary.priority,
      age_years: ageYears,
      age_days: null,
      sex: sex,
      patient_class: null,
      section_code: null,
      result_status: mapResultStatus(report.status),
      requesting_facility: null,
      testing_facility: normalizeText(facilityDisplay),
      requesting_doctor: srSummary.requesting_doctor,
      tested_by: testedBy,
      authorised_by: testedBy, // best-effort: same performer until a Provenance resource is parsed
      source_payload: { result_count: observations.length },
    },
    lab_results: lab_results,
    isolates: micro.isolates,
    susceptibility_tests: micro.susceptibility_tests,
  };
}

function parseFHIRJsonMessage(message) {
  var bundle = null;
  var reports = [];

  if (message.resourceType === 'Bundle') {
    bundle = message;
    reports = findResourcesByType(message, 'DiagnosticReport');
  } else if (message.resourceType === 'DiagnosticReport') {
    reports = [message];
  }

  if (reports.length === 0) return [];

  var records = [];
  for (var i = 0; i < reports.length; i++) {
    records.push(convertDiagnosticReport(reports[i], bundle));
  }
  return records;
}

// ---------------------------------------------------------------------------
// FHIR XML helpers (regex-based, no imports)
// ---------------------------------------------------------------------------

function xmlGetAttr(tag, attrName) {
  var re = new RegExp(attrName + '\\s*=\\s*"([^"]*)"');
  var m = tag.match(re);
  return m ? m[1] : null;
}

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

function xmlFindElements(xml, tagName) {
  var results = [];
  // Self-closing tags
  var re1 = new RegExp('<(?:[a-zA-Z0-9]+:)?' + tagName + '(?:\\s[^>]*)?\\/>', 'g');
  var m;
  while ((m = re1.exec(xml)) !== null) {
    results.push({ tag: m[0], content: '', selfClosing: true });
  }
  // Content tags
  var re2 = new RegExp('<(?:[a-zA-Z0-9]+:)?' + tagName + '(?:\\s[^>]*)?>((?:.|\\n|\\r)*?)<\\/(?:[a-zA-Z0-9]+:)?' + tagName + '>', 'g');
  while ((m = re2.exec(xml)) !== null) {
    results.push({ tag: m[0], content: m[1], selfClosing: false });
  }
  return results;
}

function xmlGetValueAttr(xml, tagName) {
  var els = xmlFindElements(xml, tagName);
  if (els.length === 0) return null;
  return xmlGetAttr(els[0].tag, 'value');
}

// Find a CodeableConcept element by name — only matches content tags (not
// self-closing) to avoid collisions like <code> vs <code value="..."/>
function xmlGetCodeableConcept(xml, tagName) {
  var content = xmlGetContent(xml, tagName);
  if (!content) return null;
  return content;
}

function xmlGetFhirCoding(xml) {
  // Look for <coding> content tag that contains child value elements
  var codingContent = xmlGetContent(xml, 'coding');
  if (!codingContent) {
    // Fallback: try self-closing <coding> with inline attributes
    var codingEls = xmlFindElements(xml, 'coding');
    if (codingEls.length === 0) return null;
    var codingTag = codingEls[0].tag;
    return {
      system: xmlGetAttr(codingTag, 'system'),
      code: xmlGetAttr(codingTag, 'code'),
      display: xmlGetAttr(codingTag, 'display'),
    };
  }
  // Wrap so xmlGetValueAttr can work on the coding content
  var wrapped = '<coding>' + codingContent + '</coding>';
  return {
    system: xmlGetValueAttr(wrapped, 'system'),
    code: xmlGetValueAttr(wrapped, 'code'),
    display: xmlGetValueAttr(wrapped, 'display'),
  };
}

function xmlGetObservationValue(obsXml) {
  // valueQuantity
  var vqEls = xmlFindElements(obsXml, 'valueQuantity');
  if (vqEls.length > 0) {
    var vqTag = vqEls[0].tag;
    return {
      value: xmlGetAttr(vqTag, 'value') || xmlGetValueAttr(vqTag, 'value'),
      unit: xmlGetAttr(vqTag, 'unit') || xmlGetValueAttr(vqTag, 'unit'),
      isNumeric: true,
    };
  }
  // valueString
  var vsEls = xmlFindElements(obsXml, 'valueString');
  if (vsEls.length > 0) {
    return {
      value: xmlGetAttr(vsEls[0].tag, 'value'),
      unit: null,
      isNumeric: false,
    };
  }
  // valueCodeableConcept
  var vccEls = xmlFindElements(obsXml, 'valueCodeableConcept');
  if (vccEls.length > 0) {
    var coding = xmlGetFhirCoding(vccEls[0].tag);
    return {
      value: coding ? (coding.display || coding.code) : null,
      unit: null,
      isNumeric: false,
      codedValue: coding ? coding.code : null,
    };
  }
  return null;
}

function parseFHIRXmlMessage(xml) {
  // Extract DiagnosticReport
  var reportEls = xmlFindElements(xml, 'DiagnosticReport');
  if (reportEls.length === 0) return [];

  var reportXml = reportEls[0].tag;

  // Report id, status, code
  var reportId = xmlGetValueAttr(reportXml, 'id');
  var reportStatus = xmlGetValueAttr(reportXml, 'status');
  var reportCodeContent = xmlGetCodeableConcept(reportXml, 'code');
  var reportCoding = reportCodeContent ? xmlGetFhirCoding(reportCodeContent) : null;
  var effectiveDateTime = xmlGetValueAttr(reportXml, 'effectiveDateTime');

  // Subject reference
  var subjectEls = xmlFindElements(reportXml, 'subject');
  var subjectRef = subjectEls.length > 0 ? xmlGetAttr(subjectEls[0].tag, 'reference') || xmlGetValueAttr(subjectEls[0].tag, 'reference') : null;

  // Performer / facility
  var performerEls = xmlFindElements(reportXml, 'performer');
  var facilityDisplay = performerEls.length > 0 ? (xmlGetAttr(performerEls[0].tag, 'display') || xmlGetValueAttr(performerEls[0].tag, 'display')) : null;
  var facilityCode = facilityDisplay;

  // Patient
  var patientEls = xmlFindElements(xml, 'Patient');
  var patientXml = patientEls.length > 0 ? patientEls[0].tag : '';
  var patientId = patientXml ? xmlGetValueAttr(patientXml, 'id') : null;
  var familyName = patientXml ? xmlGetValueAttr(patientXml, 'family') : null;
  var givenName = patientXml ? xmlGetValueAttr(patientXml, 'given') : null;
  var gender = patientXml ? xmlGetValueAttr(patientXml, 'gender') : null;
  var birthDate = patientXml ? xmlGetValueAttr(patientXml, 'birthDate') : null;

  // Patient identifier
  var identifierEls = patientXml ? xmlFindElements(patientXml, 'identifier') : [];
  var patientIdentifier = null;
  if (identifierEls.length > 0) {
    patientIdentifier = xmlGetValueAttr(identifierEls[0].tag, 'value');
  }

  // Specimen
  var specimenEls = xmlFindElements(xml, 'Specimen');
  var specimenCode = null;
  var specimenDisplay = null;
  if (specimenEls.length > 0) {
    var specTypeContent = xmlGetCodeableConcept(specimenEls[0].tag, 'type');
    if (specTypeContent) {
      var specCoding = xmlGetFhirCoding(specTypeContent);
      if (specCoding) {
        specimenCode = specCoding.code;
        specimenDisplay = specCoding.display || specCoding.code;
      }
    }
  }

  // Observations
  var observationEls = xmlFindElements(xml, 'Observation');
  var lab_results = [];

  for (var i = 0; i < observationEls.length; i++) {
    var obsXml = observationEls[i].tag;
    var obsCodeContent = xmlGetCodeableConcept(obsXml, 'code');
    var obsCoding = obsCodeContent ? xmlGetFhirCoding(obsCodeContent) : null;
    var obsEffective = xmlGetValueAttr(obsXml, 'effectiveDateTime');

    var obsVal = xmlGetObservationValue(obsXml);
    var value = obsVal ? obsVal.value : null;
    var isNumeric = obsVal ? obsVal.isNumeric : false;

    lab_results.push({
      source_test_code: reportCoding ? reportCoding.code : null,
      observation_code: obsCoding ? asConcept(SYSTEMS.TEST, obsCoding.code, obsCoding.display || obsCoding.code, 'test', 'coded') : null,
      result_value: value,
      result_type: isNumeric ? 'NM' : 'ST',
      numeric_value: isNumeric && value && !isNaN(Number(value)) ? Number(value) : null,
      coded_value: obsVal && obsVal.codedValue ? obsVal.codedValue : null,
      text_value: !isNumeric ? value : null,
      numeric_units: isNumeric && obsVal ? obsVal.unit : null,
      abnormal_flag: null,
      rpt_units: isNumeric && obsVal ? obsVal.unit : null,
      rpt_flag: null,
      rpt_range: null,
      result_timestamp: obsEffective || null,
      isolate_index: null,
      is_resulted: value !== null,
      raw_result: { xml_fragment: obsXml },
    });
  }

  var requestId = reportId || patientId || subjectRef || null;

  return [{
    patient: {
      patient_guid: patientId || requestId,
      firstname: normalizeText(givenName),
      middlename: null,
      surname: normalizeText(familyName),
      sex: gender ? gender.charAt(0).toUpperCase() : 'U',
      folder_no: patientIdentifier || patientId,
      date_of_birth: birthDate || null,
      phone: null,
      email: null,
      national_id: null,
      address: null,
      patient_data: { raw_xml: patientXml || null },
    },
    lab_request: {
      request_id: requestId,
      facility_code: asConcept(SYSTEMS.FACILITY, facilityCode, facilityDisplay, 'facility', 'coded'),
      panel_code: reportCoding ? asConcept(SYSTEMS.TEST, reportCoding.code, reportCoding.display || reportCoding.code, 'panel', 'coded') : null,
      specimen_code: specimenCode ? asConcept(SYSTEMS.SPECIMEN, specimenCode, specimenDisplay, 'specimen', 'coded') : null,
      taken_datetime: effectiveDateTime || null,
      collected_datetime: null,
      received_at: null,
      registered_at: null,
      analysis_at: null,
      authorised_at: null,
      clinical_info: null,
      icd10_codes: null,
      therapy: null,
      priority: null,
      age_years: null,
      age_days: null,
      sex: gender ? gender.charAt(0).toUpperCase() : 'U',
      patient_class: null,
      section_code: null,
      result_status: mapResultStatus(reportStatus),
      requesting_facility: null,
      testing_facility: normalizeText(facilityDisplay),
      requesting_doctor: null,
      tested_by: null,
      authorised_by: null,
      source_payload: { status: reportStatus, observation_count: lab_results.length },
    },
    lab_results: lab_results,
    isolates: [],
    susceptibility_tests: [],
  }];
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

// Convert Buffer-like objects { type: "Buffer", data: [...] } or actual
// Buffers to a UTF-8 string so downstream detection works on text.
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

  // _binary wrapper from parseMessageByContentType
  if (message._binary && typeof message.data === 'string') {
    // base64-encoded — decode it
    try {
      var decoded = '';
      var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      var src = message.data.replace(/[^A-Za-z0-9+/]/g, '');
      for (var j = 0; j < src.length; j += 4) {
        var a = b64.indexOf(src.charAt(j));
        var b = b64.indexOf(src.charAt(j + 1));
        var c = b64.indexOf(src.charAt(j + 2));
        var d = b64.indexOf(src.charAt(j + 3));
        decoded += String.fromCharCode((a << 2) | (b >> 4));
        if (c !== -1) decoded += String.fromCharCode(((b & 15) << 4) | (c >> 2));
        if (d !== -1) decoded += String.fromCharCode(((c & 3) << 6) | d);
      }
      return decoded;
    } catch (e) {
      return message;
    }
  }

  return message;
}

function detectFormat(message) {
  if (typeof message === 'object' && message !== null) {
    if (message.resourceType) return 'fhir-json';
    // Buffer-like or _binary — will be coerced to string in parseMessage
    if ((message.type === 'Buffer' && Array.isArray(message.data)) || message._binary) return 'buffer';
    return 'unknown';
  }
  if (typeof message !== 'string') return 'unknown';
  var trimmed = message.trim();
  if (trimmed.substring(0, 3) === 'MSH' && trimmed.charAt(3) === '|') return 'hl7v2';
  if (trimmed.charAt(0) === '<') return 'fhir-xml';
  if (trimmed.charAt(0) === '{') return 'fhir-json-string';
  return 'unknown';
}

function parseMessage(message) {
  var format = detectFormat(message);

  // If buffer-like, coerce to string and re-detect
  if (format === 'buffer') {
    var str = coerceToStringOrObject(message);
    return parseMessage(str);
  }

  if (format === 'fhir-json') return { format: 'fhir-json', records: parseFHIRJsonMessage(message) };
  if (format === 'fhir-json-string') {
    var parsed = JSON.parse(message);
    return { format: 'fhir-json', records: parseFHIRJsonMessage(parsed) };
  }
  if (format === 'fhir-xml') return { format: 'fhir-xml', records: parseFHIRXmlMessage(message) };
  if (format === 'hl7v2') return { format: 'hl7v2', records: [parseHL7v2Message(message)] };
  return { format: 'unknown', records: [] };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateHL7v2(text) {
  var errors = [];
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
  return errors;
}

function validateFHIRJson(message) {
  var errors = [];
  if (!message || typeof message !== 'object') {
    errors.push('Message must be a JSON object');
    return errors;
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
  return errors;
}

function validateFHIRXml(text) {
  var errors = [];
  if (!text || text.trim().length === 0) {
    errors.push('XML content is empty');
    return errors;
  }
  var hasBundle = text.indexOf('<Bundle') >= 0;
  var hasDiagnosticReport = text.indexOf('<DiagnosticReport') >= 0;
  if (!hasBundle && !hasDiagnosticReport) {
    errors.push('FHIR XML must contain a Bundle or DiagnosticReport resource');
  }
  if (hasBundle) {
    var entries = xmlFindElements(text, 'entry');
    if (entries.length === 0) {
      errors.push('Bundle must contain at least one entry');
    }
    if (!hasDiagnosticReport) {
      errors.push('Bundle must contain at least one DiagnosticReport resource');
    }
  }
  return errors;
}

function validate(message) {
  var format = detectFormat(message);

  // Coerce buffer-like input and re-validate
  if (format === 'buffer') {
    return validate(coerceToStringOrObject(message));
  }

  var errors = [];

  if (format === 'hl7v2') {
    errors = validateHL7v2(message);
  } else if (format === 'fhir-json') {
    errors = validateFHIRJson(message);
  } else if (format === 'fhir-json-string') {
    errors = validateFHIRJson(JSON.parse(message));
  } else if (format === 'fhir-xml') {
    errors = validateFHIRXml(message);
  } else {
    errors.push('Unrecognised format: expected HL7 v2 message, FHIR JSON, or FHIR XML');
  }

  return {
    valid: errors.length === 0,
    reason: errors.length === 0 ? null : 'HL7/FHIR validation failed',
    details: errors.length === 0 ? {} : { errors: errors },
  };
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

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
      plugin_name: 'hl7-fhir-schema',
      plugin_version: '2.3.0',
      source_system: 'HL7/FHIR',
    },
  };

  if (!out.lab_request.obr_set_id) {
    out.lab_request.obr_set_id = 1;
  }

  ensureSystem(out.lab_request.facility_code, SYSTEMS.FACILITY);
  ensureSystem(out.lab_request.panel_code, SYSTEMS.TEST);
  ensureSystem(out.lab_request.specimen_code, SYSTEMS.SPECIMEN);

  for (var i = 0; i < out.lab_results.length; i++) {
    ensureSystem(out.lab_results[i].observation_code, SYSTEMS.TEST);
  }

  for (var j = 0; j < out.isolates.length; j++) {
    ensureSystem(out.isolates[j].organism_code, SYSTEMS.ORG);
  }

  for (var k = 0; k < out.susceptibility_tests.length; k++) {
    ensureSystem(out.susceptibility_tests[k].antibiotic_code, SYSTEMS.ABX);
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

module.exports = { name: 'hl7-fhir-schema', version: '2.3.0', status: 'active', validate: validate, convert: convert };
