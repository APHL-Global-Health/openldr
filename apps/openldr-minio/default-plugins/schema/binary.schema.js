// Magic bytes for known binary formats
var MAGIC_BYTES = {
  PDF: { header: '%PDF', label: 'PDF document' },
  JPEG: { header: '\xFF\xD8\xFF', label: 'JPEG image' },
  PNG: { header: '\x89PNG', label: 'PNG image' },
};

function detectFormat(data) {
  if (!data || data.length === 0) return null;
  var head = data.substring(0, 10);
  if (head.indexOf('%PDF') === 0) return MAGIC_BYTES.PDF;
  // Check for JPEG SOI marker
  if (data.charCodeAt(0) === 0xFF && data.charCodeAt(1) === 0xD8 && data.charCodeAt(2) === 0xFF) return MAGIC_BYTES.JPEG;
  // Check for PNG signature
  if (data.charCodeAt(0) === 0x89 && head.indexOf('PNG') === 1) return MAGIC_BYTES.PNG;
  return null;
}

function validate(message) {
  var errors = [];
  var data = typeof message === 'string' ? message : String(message || '');

  if (!data || data.length === 0) {
    errors.push('Binary content is empty');
    return { valid: false, reason: 'Binary validation failed', details: { errors: errors } };
  }

  var detected = detectFormat(data);

  return {
    valid: true,
    reason: null,
    details: {
      size_bytes: data.length,
      detected_format: detected ? detected.label : 'unknown binary',
    },
  };
}

function convert(message) {
  var data = typeof message === 'string' ? message : String(message || '');
  var detected = detectFormat(data);

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
        size_bytes: data.length,
        detected_format: detected ? detected.label : 'unknown binary',
      },
    },
    lab_results: [],
    isolates: [],
    susceptibility_tests: [],
    _plugin: {
      plugin_name: 'binary-schema',
      plugin_version: '1.0.0',
      source_system: 'binary',
      note: 'Binary content - no structured lab data extraction. Content stored as-is for downstream processing.',
    },
  };
}

module.exports = { name: 'binary-schema', version: '1.0.0', status: 'active', validate: validate, convert: convert };
