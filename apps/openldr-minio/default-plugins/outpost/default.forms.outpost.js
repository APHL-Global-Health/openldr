// Forms outpost plugin — passthrough for MVP. Returns a small summary so the
// stage tracker has something to log; emits no external dispatch.

function process(payload) {
  var sub = payload && payload.submission;
  return {
    success: true,
    action: 'noop',
    notes: ['Bundled default forms-outpost plugin used', 'No downstream push performed by default forms-outpost plugin'],
    processed_at: new Date().toISOString(),
  };
}

module.exports = { name: 'default-forms-outpost', version: '1.0.0', status: 'active', process: process };
