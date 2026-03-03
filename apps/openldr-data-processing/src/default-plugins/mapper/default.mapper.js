function mapping(message) {
  return {
    transformedMessage: message,
    fieldMappings: [],
  };
}

module.exports = {
  name: 'default-mapper',
  version: '1.1.0',
  status: 'active',
  mapping,
};
