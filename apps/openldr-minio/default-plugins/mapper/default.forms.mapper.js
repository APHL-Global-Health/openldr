// Forms mapper plugin.
//
// Signature: map(message) — single argument, no host object.
// Matches the lab default.mapper.js convention exactly.
//
// Concept resolution (facility_code → facility_concept_id, each
// response.concept_code → concept_id) is performed by the host pipeline
// AFTER this function returns: runtime-plugin.service.ts calls
// terminologyService.resolveConceptReferencesInMessage(processedMessage),
// which walks every key ending in "_code" whose value is a
// { system_id, concept_code, display_name } object and upserts/resolves it
// to a UUID written into the matching "*_concept_id" key.
//
// Patient upsert happens inside persistFormSubmissionToExternal (the forms
// persistence service) directly from submission.patient, matching the pattern
// used by persistProcessedMessageToExternal for lab messages.  The mapper
// does not write _resolved_patient_id.
//
// Facility UUID is populated by enrichMessageWithMetadata in the storage
// handler (from dataFeed.facilityId) into _metadata.facility.facility_id
// before persistence runs.  The mapper does not write _resolved_facility_id.
//
// Return: the payload unchanged (same contract as default.mapper.js).

function map(message) {
  return message;
}

module.exports = {
  name: 'default-forms-mapper',
  version: '1.0.0',
  status: 'active',
  map: map,
};
