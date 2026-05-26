function process(message) {
  return {
    success: true,
    processed: {
      patients: message.patient ? 1 : 0,
      requests: message.lab_request ? 1 : 0,
      results: Array.isArray(message.lab_results) ? message.lab_results.length : 0,
      isolates: Array.isArray(message.isolates) ? message.isolates.length : 0,
      susceptibility_tests: Array.isArray(message.susceptibility_tests) ? message.susceptibility_tests.length : 0,
    },
    errors: [],
    record_ids: {
      patients: [],
      requests: [],
      results: [],
      isolates: [],
      susceptibility_tests: [],
    },
    notes: ['Bundled default storage plugin used', 'No persistence performed by default storage plugin'],
    processing_completed: new Date().toISOString(),
  };
}
module.exports = { name: 'default-storage', version: '1.2.0', status: 'active', process };
