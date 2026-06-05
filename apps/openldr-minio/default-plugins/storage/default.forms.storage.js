// Forms storage plugin. The actual DB writes happen in the data-processing
// service (forms-persistence.service.ts); this plugin just summarises the
// payload for traceability and ratifies that the envelope is what we expect.

function process(payload) {
  var sub = payload && payload.submission;
  if (!sub) {
    throw new Error('forms storage plugin: missing submission');
  }
  var responses = Array.isArray(sub.responses) ? sub.responses : [];
  return {
    success: true,
    processed: {
      submissions: 1,
      responses: responses.length,
      patient_resolved: !!payload._resolved_patient_id,
      facility_resolved: !!payload._resolved_facility_id,
    },
    errors: [],
    record_ids: {
      submissions: [],
      responses: [],
    },
    notes: ['Bundled default forms-storage plugin used', 'No persistence performed by default forms-storage plugin'],
    processing_completed: new Date().toISOString(),
  };
}

module.exports = { name: 'default-forms-storage', version: '1.0.0', status: 'active', process: process };
