// Form-submission envelope schema. Schemaless-first: form_id/form_code is
// optional; required is the patient + facility code + at least one response
// with a value_type. Concept resolution is best-effort and happens in the
// mapper.

function fail(reason, details) {
  return { valid: false, reason: reason, details: details || {} };
}

function ok() {
  return { valid: true, reason: null, details: {} };
}

function validate(payload) {
  if (!payload || typeof payload !== 'object') return fail('payload-not-object');
  var sub = payload.submission;
  if (!sub || typeof sub !== 'object') return fail('submission-missing');

  if (!sub.external_ref || typeof sub.external_ref !== 'string') {
    return fail('external_ref-required', { got: typeof sub.external_ref });
  }
  if (!sub.patient || typeof sub.patient !== 'object') {
    return fail('patient-missing');
  }
  if (!sub.patient.patient_guid || typeof sub.patient.patient_guid !== 'string') {
    return fail('patient_guid-required');
  }
  if (!sub.facility_code || typeof sub.facility_code !== 'object') {
    return fail('facility_code-missing');
  }
  if (!sub.facility_code.concept_code || typeof sub.facility_code.concept_code !== 'string') {
    return fail('facility_code.concept_code-required');
  }
  if (!Array.isArray(sub.responses) || sub.responses.length === 0) {
    return fail('responses-required', { expected: 'non-empty array' });
  }
  for (var i = 0; i < sub.responses.length; i++) {
    var r = sub.responses[i];
    if (!r || typeof r !== 'object') return fail('response-not-object', { index: i });
    if (['numeric', 'text', 'coded'].indexOf(r.value_type) === -1) {
      return fail('value_type-invalid', { index: i, got: r.value_type });
    }
    if (!r.concept_code || typeof r.concept_code !== 'object' ||
        typeof r.concept_code.concept_code !== 'string') {
      return fail('response.concept_code-required', { index: i });
    }
  }
  return ok();
}

function convert(payload) {
  var sub = payload.submission;
  var responses = sub.responses.map(function (r, i) {
    return Object.assign({}, r, { ordinal: typeof r.ordinal === 'number' ? r.ordinal : i + 1 });
  });
  return Object.assign({}, payload, { submission: Object.assign({}, sub, { responses: responses }) });
}

module.exports = { name: 'default-forms-schema', version: '1.0.0', status: 'active', validate: validate, convert: convert };
