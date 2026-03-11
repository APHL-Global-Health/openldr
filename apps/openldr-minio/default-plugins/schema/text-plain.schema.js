function normalizeText(value) {
  if (value === null || value === undefined) return null;
  var text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

function validate(message) {
  var errors = [];
  var text = typeof message === 'string' ? message : String(message || '');

  if (!text || text.trim().length === 0) {
    errors.push('Text content is empty');
    return { valid: false, reason: 'Plain text validation failed', details: { errors: errors } };
  }

  return {
    valid: true,
    reason: null,
    details: {
      character_count: text.length,
      line_count: text.split(/\r?\n/).length,
    },
  };
}

function convert(message) {
  var text = typeof message === 'string' ? message : String(message || '');
  var lines = text.split(/\r?\n/);

  return {
    patient: {
      patient_guid: null,
      firstname: null,
      middlename: null,
      surname: null,
      sex: 'U',
      folder_no: null,
      address: null,
      patient_data: {},
    },
    lab_request: {
      request_id: null,
      facility_code: null,
      panel_code: null,
      specimen_code: null,
      clinical_diagnosis: null,
      taken_datetime: null,
      collected_datetime: null,
      received_in_lab_datetime: null,
      priority: null,
      source_payload: {
        character_count: text.length,
        line_count: lines.length,
        preview: text.substring(0, 500),
      },
    },
    lab_results: [],
    isolates: [],
    susceptibility_tests: [],
    _plugin: {
      plugin_name: 'text-plain-schema',
      plugin_version: '1.0.0',
      source_system: 'plain text',
      note: 'Plain text content - no structured lab data extraction. Content stored as-is for downstream processing.',
    },
  };
}

module.exports = { name: 'text-plain-schema', version: '1.0.0', status: 'active', validate: validate, convert: convert };
