function run(message) {
  console.log("Default outpost plugin executed with message:", message);
  return {
    success: true,
    action: 'noop',
    notes: ['Bundled default outpost plugin used', 'No downstream push performed by default outpost plugin'],
    processed_at: new Date().toISOString(),
    message_id: message?._metadata?.message?.message_id || null,
  };
}
module.exports = { name: 'default-outpost', version: '1.0.0', status: 'active', run };
