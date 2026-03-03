# OpenLDR v2 Data Processing Service

## Overview

The OpenLDR v2 Data Processing Service is an event-driven pipeline responsible for receiving incoming lab data, validating and normalizing it into an OpenLDR v2 canonical structure, resolving terminology, enforcing storage-level integrity checks, and finally handing fully processed payloads to an outpost stage for downstream delivery.

The service is built around four pipeline stages:

1. `validation`
2. `mapping`
3. `storage`
4. `outpost`

The service supports runtime plugins loaded from MinIO and executed inside a sandboxed VM. If a configured plugin does not exist, cannot be loaded, or is not configured, the service falls back to bundled default plugins.

This design gives you:

- predictable default behavior out of the box
- controlled extensibility through plugins
- version-aware plugin execution
- hard-stop failures with clear dead-letter messages
- terminology auto-creation for new codes
- a clean boundary between ingestion, normalization, mapping, validation, and downstream delivery

---

## High-level pipeline

```text
raw-inbound
  -> validation
  -> mapped-inbound
  -> storage
  -> processed-inbound
  -> outpost
```

There are also dead-letter topics for failures at each stage:

- `raw-inbound-dead-letter`
- `mapped-inbound-dead-letter`
- `processed-inbound-dead-letter`
- `outpost-dead-letter` (recommended for the outpost stage)

The exact topics in your deployment may vary slightly depending on how the consumers are wired, but the principle remains the same: every hard failure routes the original message and a structured error payload to DLQ.

---

## Service goals

The new service is designed to solve several problems in the old flow:

### 1. Default behavior should always exist
Previously, a missing plugin could cause an error, a silent skip, or inconsistent handling. Now every stage has a bundled default plugin:

- `default.schema.js`
- `default.mapper.js`
- `default.storage.js`
- `default.outpost.js`

### 2. Validation should normalize, not only reject
Validation is no longer a light schema check. It is now responsible for recognizing inbound source structure and converting it into a canonical OpenLDR v2 payload.

### 3. Terminology should be resolved centrally
Rather than depending on heavy external API calls for every code translation, the pipeline now resolves concepts against local coding systems and concepts tables. Missing concepts are auto-created during mapping.

### 4. Failures should be explicit and traceable
All stages now hard-stop on failures. Every failure is published to DLQ in a human-readable structure with the original Kafka message and, when possible, the resolved source payload.

### 5. Historical compatibility should not break
Plugins support versioning. A feed can target a specific plugin version, while the service can still fall back to an active bundled default when needed.

---

## Core architecture

### Event-driven stages
Each stage consumes from a Kafka topic, processes the message, and emits to the next stage.

### Runtime plugin execution
Plugins are JavaScript files loaded from MinIO or from bundled defaults. They are executed through a VM-based runtime service. The TypeScript application provides orchestration, safety checks, terminology access, and DLQ handling.

### Canonical model
Validation converts incoming source payloads into a canonical structure shaped around OpenLDR concepts. The current default canonical structure is:

```json
{
  "patient": { ... },
  "lab_request": { ... },
  "lab_results": [ ... ],
  "isolates": [ ... ],
  "susceptibility_tests": [ ... ]
}
```

### Terminology services
The terminology layer is responsible for:

- ensuring coding systems exist
- resolving concepts by `(system_id, concept_code)`
- auto-creating missing concepts
- normalizing concept display values before creation
- preserving useful source metadata in concept properties

---

## Stage-by-stage behavior

## 1. Validation stage

### Input
The validation stage consumes raw object-created notifications and retrieves the uploaded payload from MinIO.

### Responsibility
Validation has two jobs:

1. Decide whether the selected schema plugin can validate the source message.
2. Convert the source message into canonical OpenLDR v2 structure.

### Plugin contract
A schema plugin may expose:

- `validate(message, context)`
- `convert(message, context)`

The current default schema plugin understands a DISA*Lab-like JSON payload.

### Validation output
The output of validation is a canonical payload containing concept reference objects instead of final concept IDs.

Example:

```json
{
  "lab_request": {
    "facility_code": {
      "system_id": "WHONET_FACILITY",
      "concept_code": "HHAAL",
      "display_name": "Katumbi",
      "concept_class": "facility",
      "datatype": "coded",
      "properties": {
        "Region": "110853-9",
        "District": "Dispensary",
        "PostalAddress": "Uvinza",
        "Street": "Kigoma"
      }
    }
  }
}
```

### Important validation rules

- `facility_code` is required as a coded concept reference
- free-text-only facility values are not accepted
- coding systems referenced in canonical output must already exist in `coding_systems`
- malformed payloads fail hard and route to DLQ

### Classification rules in the default schema plugin
The bundled default schema plugin currently classifies DISA*Lab-like source data as follows:

- ordinary observations -> `lab_results`
- `ORGS` with organism values -> `isolates`
- susceptibility rows (`ResultType = 4`) -> `susceptibility_tests`

It also filters structural and noise-like rows so that obvious formatting markers are not promoted into first-class observations.

---

## 2. Mapping stage

### Input
The mapping stage consumes validated canonical messages containing concept reference objects.

### Responsibility
Mapping resolves concept references to real concept IDs and rewrites the payload to use `*_concept_id` fields.

### Plugin contract
A mapper plugin may expose one of the following patterns:

- `mapping(message, context)`
- `map(message, context)`

The mapper can either:

- return mapping instructions
- transform the canonical message directly
- or rely on built-in fallback behavior

### What mapping does now

- resolves existing concepts
- auto-creates missing concepts
- replaces fields such as `facility_code` with `facility_concept_id`
- records per-record resolution metadata
- preserves plugin metadata in `_mapper`
- records summary counts in `_mapping_results`

### Auto-creation behavior
If a concept does not exist for a known coding system, mapping creates it automatically.

This is especially important for:

- new facilities from HFR or LIS feeds
- new organisms
- new antibiotics
- newly introduced local coded observations

### Concept hygiene
Before auto-creating a concept, mapping now:

- normalizes the concept code to uppercase
- cleans the display name
- falls back to the code if the display is blank or poor
- stores the incoming original display in concept properties when useful

### Isolate linking
The mapping-related improvements also depend on validation grouping rules. The current logic deduplicates isolates by request and organism identity so repeated organism rows do not create unnecessary duplicate isolates.

---

## 3. Storage stage

### Why the name changed
The old idea of a `recipient` plugin was too vague and did not match what the stage actually does. The final persistence gate is now called `storage`.

### Responsibility
Storage does not only save data. It acts as the final integrity checkpoint before the message is considered fully processed.

### Plugin contract
A storage plugin may expose a processing function appropriate for your existing runtime model. The bundled default plugin is intentionally non-persistent and only simulates a successful processing result.

### Storage checks
Storage validates that the canonical message is ready for downstream usage. Examples include:

- required patient and request identity fields exist
- required concept IDs exist
- susceptibility rows reference valid isolates
- isolate and result linkage is coherent

### Output
If storage succeeds, the message is emitted to the `processed-inbound` topic for final handling by outpost.

The current bundled `default.storage.js` does not save to MinIO or to a database. It returns a structured processing summary instead.

---

## 4. Outpost stage

### Purpose
Outpost is the terminal stage of the pipeline.

It is intended for actions that happen after the payload has successfully passed the pipeline, for example:

- push to external systems
- persist to database
- publish to another integration endpoint
- trigger downstream workflows

### Why outpost exists
Storage should validate that the message is safe for final use. Outpost should decide what to do with that safe message.

This separation keeps your architecture clean:

- `storage` confirms the message is ready
- `outpost` performs the final side effect

### Current behavior
The bundled `default.outpost.js` is intentionally simple. It acts as a no-op success plugin until you write the real outbound logic.

### Important note
Outpost is the end of the line. It should not write back into the same ingestion pipeline buckets. If data reached outpost successfully, the pipeline is assumed to have completed correctly.

---

## Plugin model

## Plugin types

The service now supports these plugin categories:

- `schema`
- `mapper`
- `storage`
- `outpost`

## Plugin fallback behavior
If a plugin:

- is not configured
- does not exist in the database
- cannot be loaded from MinIO
- is disabled
- or resolves to an unusable version

then the service falls back to a bundled default plugin for that stage.

## Plugin versioning
Plugin selection supports version-aware behavior so historical data processing does not break.

A plugin record should carry metadata such as:

- plugin name
- plugin version
- plugin type
- MinIO object path
- security level
- status (`active`, `deprecated`, `disabled`)

Selection rules are:

1. Use the exact configured version when available.
2. If exact selection fails, use the latest active bundled default.
3. Deprecated versions may still be used intentionally for historical compatibility.
4. Disabled plugins should not be selected for execution.

## Plugin selection metadata
The service now records plugin selection decisions in both success and failure paths, for example under `_plugin_selection` and stage-specific metadata blocks.

This helps you answer questions like:

- Which plugin version processed this message?
- Did it come from MinIO or from a bundled fallback?
- Was a deprecated version used intentionally?

---

## Error handling model

## Hard-stop policy
All stage errors are now hard stops.

That means if any stage fails:

- processing stops immediately
- the message is not silently skipped
- the error is wrapped in a structured pipeline error
- the message is routed to the stage's DLQ topic

This applies to all stages:

- validation
- mapping
- storage
- outpost

## Structured pipeline errors
The service now uses a common structured error format. Each error includes fields like:

- `error_id`
- `stage`
- `code`
- `message`
- `details`
- `plugin`
- `severity`
- `retryable`
- `cause_message`
- `stack`

### Example

```json
{
  "name": "PipelineStageError",
  "stage": "validation",
  "code": "PLUGIN_VALIDATION_FAILED",
  "message": "DISA*Lab-like schema validation failed",
  "details": {
    "validation_details": {
      "errors": [
        "Facility object is required",
        "Facility.Code is required"
      ]
    }
  },
  "severity": "error",
  "retryable": false
}
```

## Retryability guidance
The service distinguishes between failures that are logically retryable and those that are not.

### Usually not retryable

- malformed payloads
- missing required fields
- failed schema validation
- storage integrity failures caused by bad data

### Usually retryable

- temporary MinIO read failure
- transient database connectivity problem
- Kafka or network interruption
- temporary terminology write failure

## Error summaries
Errors now also include a summary block so operators can quickly understand the failure without reading the full stack.

---

## Dead-letter queue behavior

## What goes to DLQ
Any hard-stop failure is published to a DLQ message.

## DLQ body structure
The DLQ message body is now self-contained and human readable. It includes:

- source topic, partition, offset
- failure timestamp
- structured error object
- original Kafka key and headers
- original Kafka value
- resolved source payload from MinIO, when available
- plugin selection metadata

### Example shape

```json
{
  "dlq": {
    "source_topic": "raw-inbound",
    "failed_at": "2026-03-03T11:15:51.465Z",
    "error": {
      "stage": "validation",
      "code": "PLUGIN_VALIDATION_FAILED",
      "message": "DISA*Lab-like schema validation failed"
    }
  },
  "original_message": {
    "key": "bucket/raw/feed/message.json",
    "headers": {},
    "value": { "EventName": "s3:ObjectCreated:Put" }
  },
  "resolved_payload": {
    "...": "actual uploaded source payload, when retrievable"
  }
}
```

## Why this matters
This makes DLQ messages usable even when your Kafka UI does not show headers. It also reduces the need to jump between Kafka, MinIO, and application logs during debugging.

---

## Workflow examples

## Workflow 1: Valid message, no custom plugins configured

1. A raw file lands in MinIO.
2. MinIO emits an object-created event.
3. The service consumes the event from `raw-inbound`.
4. Validation selects the bundled default schema plugin.
5. Validation converts the payload into canonical OpenLDR structure.
6. Validation checks referenced coding systems.
7. Mapping selects the bundled default mapper plugin.
8. Mapping resolves and auto-creates concepts.
9. Storage selects the bundled default storage plugin.
10. Storage validates canonical integrity and marks the message as processed.
11. The processed message is emitted to `processed-inbound`.
12. Outpost selects the bundled default outpost plugin.
13. Outpost completes successfully with no final external side effect.

Result:
- processed payload available
- plugin metadata recorded
- no DLQ activity

## Workflow 2: Invalid message

1. A malformed raw file lands in MinIO.
2. Validation reads the payload.
3. The schema plugin returns a rich validation failure.
4. The validation handler wraps that in a `PipelineStageError`.
5. The consumer sends the message to `raw-inbound-dead-letter`.
6. The DLQ body includes both the original event and the validation details.

Result:
- message does not continue to mapping
- failure is visible in Kafka without checking app logs

## Workflow 3: Unknown facility code with known coding system

1. Validation normalizes `facility_code` to a concept reference.
2. The coding system `WHONET_FACILITY` exists.
3. Mapping does not find the facility concept.
4. Mapping auto-creates a new concept.
5. The request receives a `facility_concept_id`.

Result:
- pipeline succeeds
- concept catalog grows in a controlled way

## Workflow 4: Known feed with old plugin version

1. Feed configuration points to an older plugin version.
2. The service resolves that exact version if still allowed.
3. Message is processed under that historical logic.
4. Plugin selection metadata records the chosen version.

Result:
- historical behavior is preserved
- new changes do not break legacy feed behavior

---

## Terminology and concepts

## Coding systems
Before validation can succeed, any coding system referenced by the canonical payload must exist in `coding_systems`.

Examples used by the current default flow:

- `WHONET_FACILITY`
- `WHONET_TEST`
- `WHONET_SPEC`
- `WHONET_ORG`
- `WHONET_ABX`

## Concepts
Concepts are created or reused during mapping.

Fields commonly mapped in the default flow include:

- `facility_code -> facility_concept_id`
- `panel_code -> panel_concept_id`
- `specimen_code -> specimen_concept_id`
- `observation_code -> observation_concept_id`
- `organism_code -> organism_concept_id`
- `antibiotic_code -> antibiotic_concept_id`

## Facility handling
Facility is intentionally strict:

- facility must be represented as a coded concept reference
- free-text-only facility is rejected
- additional facility attributes can be carried in concept properties

This is important because LIS-side facility codes can change over time and need to remain trackable through terminology management.

---

## Data model notes

### Patient
Carries core patient identity and raw-source references.

### Lab request
Carries request-level context such as:

- request ID
- facility concept
- panel concept
- specimen concept
- collection and receipt dates
- clinical diagnosis

### Lab results
Carries ordinary observations that are not isolates or susceptibility results.

### Isolates
Represents identified organisms. The improved logic deduplicates isolates per request and organism.

### Susceptibility tests
Represents antibiotic susceptibility observations linked to isolates.

---

## Operational notes

## Observability
For successful messages, the pipeline records stage metadata such as:

- `_validation`
- `_mapper`
- `_storage`
- `_plugin_selection`
- `_processing_results`

For failed messages, DLQ contains:

- the structured error
- the original message
- the resolved payload when possible
- enough plugin metadata to trace processing decisions

## Backward compatibility
The service is intentionally tolerant during transition.

- older feeds can still work with legacy plugin configuration paths
- storage supports the migration away from the older `recipient` naming
- mapper supports both older config-style mapping and newer VM plugin behavior

## Safety posture
Bundled default plugins make the system safer to operate because a missing plugin no longer causes undefined behavior. Instead, the pipeline uses a known fallback, or fails clearly if fallback cannot logically continue.

---

## Recommended deployment checklist

Before enabling a feed in production:

1. Ensure required coding systems exist.
2. Decide whether the feed uses default plugins or custom plugins.
3. If using custom plugins, register plugin metadata and MinIO object paths.
4. Confirm plugin version selection rules.
5. Test with:
   - one valid payload
   - one invalid payload
   - one payload with a new concept code
6. Confirm DLQ visibility in your Kafka UI.
7. Confirm outpost is either no-op or configured for the intended downstream target.

---

## Future extension ideas

The current architecture is ready for additional improvements later, such as:

- richer per-feed plugin selection rules
- explicit retry policies per error code
- outpost plugin delivery tracking
- concept review workflows for auto-created concepts
- facility registry synchronization
- more LIS-specific default schema plugins
- stronger linkage between isolate groups and susceptibility clusters

---

## Changelog

See the companion `CHANGELOG.md` for a narrative summary of the redesign and the key milestones that were added during this work.
