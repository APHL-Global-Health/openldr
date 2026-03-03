function process(message) {
  const patientCount = message && message.patient ? 1 : 0;
  const requestCount = message && message.lab_request ? 1 : 0;
  const resultCount = Array.isArray(message && message.lab_results) ? message.lab_results.length : 0;
  const isolateCount = Array.isArray(message && message.isolates) ? message.isolates.length : 0;
  const susceptibilityCount = Array.isArray(message && message.susceptibility_tests)
    ? message.susceptibility_tests.length
    : 0;

  return {
    success: true,
    processed: {
      patients: patientCount,
      requests: requestCount,
      results: resultCount,
      isolates: isolateCount,
      susceptibility_tests: susceptibilityCount,
    },
    errors: [],
    record_ids: {
      patients: [],
      requests: [],
      results: [],
      isolates: [],
      susceptibility_tests: [],
    },
    notes: [
      'Bundled default recipient plugin used',
      'No persistence performed by default recipient plugin',
    ],
    processing_completed: new Date().toISOString(),
  };
}

module.exports = {
  name: 'default-recipient',
  version: '1.1.0',
  status: 'active',
  process,
};
