# Changelog

## Unreleased

### Added
- Default plugin fallbacks for all main stages.
- Bundled schema, mapper, storage, and outpost plugins.
- Runtime VM execution for plugin code loaded from MinIO or bundled defaults.
- Structured canonical output with:
  - `patient`
  - `lab_request`
  - `lab_results`
  - `isolates`
  - `susceptibility_tests`
- Required coded facility handling using `facility_code` and `facility_concept_id`.
- Coding system existence checks during validation.
- Concept auto-creation during mapping.
- Isolate deduplication improvements.
- Better susceptibility-to-isolate linking.
- Observation filtering to reduce structural/noise rows.
- Concept normalization and display-name hygiene before auto-create.
- Plugin version-awareness and plugin-selection metadata.
- Structured hard-stop errors using a shared pipeline error model.
- Human-readable DLQ bodies with source message and error details.
- Resolved raw payload inclusion in DLQ messages when available.
- Error severity, retryability, error IDs, and summaries.
- New outpost terminal stage for downstream delivery.

### Changed
- Renamed the final plugin concept from `recipient` to `storage`.
- Storage now acts as the last integrity gate before outpost.
- Validation now performs both recognition and conversion into canonical OpenLDR structure.
- Mapper now resolves concepts and creates missing concepts instead of depending on an external OCL-style API path.
- All stage failures now hard-stop instead of silently skipping.

### Fixed
- Missing plugins now use bundled defaults instead of causing undefined behavior.
- Validation failures now route to DLQ rather than logging and returning.
- DLQ messages now include readable body content even when Kafka headers are not visible in tooling.
- Repeated organism rows no longer create unnecessary duplicate isolates under the improved logic.

## Migration notes

### From old `recipient` naming
- `recipient` should be considered deprecated in favor of `storage`.
- During transition, compatibility paths may still support legacy feed configuration.

### Plugin behavior
- If a feed does not explicitly provide a plugin, the service uses a bundled default.
- Historical versions can continue to run when explicitly selected.

### DLQ behavior
- Operators should now inspect DLQ message bodies, not only application logs.
- The DLQ payload is intentionally self-contained for debugging and support.
