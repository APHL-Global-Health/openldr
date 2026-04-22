# Plugin Guide

OpenLDR uses a plugin-based pipeline to ingest, validate, transform, and store laboratory data. This guide covers how to register plugins, configure data feeds, send data through the pipeline, and monitor results.

For writing custom plugins, see the [Extension Plugin Development Guide](../apps/openldr-minio/docs/PLUGINS.md).

## Table of Contents

- [How the Pipeline Works](#how-the-pipeline-works)
- [Plugin Types](#plugin-types)
- [Registering Plugins](#registering-plugins)
- [Configuring Data Feeds](#configuring-data-feeds)
- [Sending Data](#sending-data)
- [Canonical JSON Format](#canonical-json-format)
- [Concept Objects](#concept-objects)
- [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
- [Default Plugins](#default-plugins)
- [Field Reference](#field-reference)

---

## How the Pipeline Works

Every file uploaded to OpenLDR passes through four stages, each handled by a plugin:

```
Upload → Schema → Mapper → Storage → Outpost
           │         │         │         │
       validate   map()    process()  process()
       convert()
```

Each stage writes its output to MinIO and publishes a Kafka message for the next stage:

| Stage | Kafka Topic | MinIO Path | Purpose |
|-------|------------|------------|---------|
| Upload | `raw-inbound` | `{project}/raw/{feedId}/{messageId}.json` | Raw file storage |
| Schema | `validated-inbound` | `{project}/validated/{feedId}/{messageId}.json` | Validation and conversion |
| Mapper | `mapped-inbound` | `{project}/mapped/{feedId}/{messageId}.json` | Terminology resolution |
| Storage | `processed-inbound` | `{project}/processed/{feedId}/{messageId}.json` | Database persistence |
| Outpost | - | - | Downstream push (optional) |

If any stage fails, the message goes to a dead-letter topic (`{topic}-dead-letter`).

---

## Plugin Types

| Type | DB Value | Entry Points | Purpose |
|------|----------|-------------|---------|
| **Schema** | `validation` | `validate(message)`, `convert(message)` | Parse and validate incoming data, convert to canonical records |
| **Mapper** | `mapping` | `map(message)` | Resolve terminology codes to concept IDs |
| **Storage** | `storage` | `process(message)` | Record counting and pre-persistence checks |
| **Outpost** | `outpost` | `process(message)` | Push data to external systems |

---

## Registering Plugins

Upload a plugin JavaScript file via the API:

```
POST /api/v1/plugin/create-plugin
Content-Type: multipart/form-data
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `pluginData` | Yes | The `.js` plugin file |
| `pluginType` | Yes | `validation`, `mapping`, `storage`, or `outpost` |
| `pluginName` | Yes | Human-readable name (e.g., `whonet-schema`) |
| `pluginVersion` | Yes | Semantic version (e.g., `1.2.0`) |
| `securityLevel` | No | `low`, `medium`, or `high` (default: `low`) |
| `config` | No | JSON object with plugin-specific settings |
| `notes` | No | Description or documentation |

**Other plugin endpoints:**

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/v1/plugin/plugins` | List all plugins |
| GET | `/api/v1/plugin/get-plugins?pluginType={type}` | List by type |
| GET | `/api/v1/plugin/get-plugin/{pluginId}` | Get plugin details |
| PUT | `/api/v1/plugin/update-plugin/{pluginId}` | Update plugin |
| DELETE | `/api/v1/plugin/delete-plugin/{pluginId}` | Delete plugin |

---

## Configuring Data Feeds

A data feed ties a set of four plugins together. When data is uploaded, the feed determines which plugins process it.

### Create a data feed

```
POST /api/v1/datafeed/create
Content-Type: application/json

{
  "dataFeedName": "My Lab Feed",
  "useCaseId": "{useCaseId}",
  "schemaPluginId": "{pluginId}",
  "mapperPluginId": "{pluginId}",
  "storagePluginId": "{pluginId}",
  "outpostPluginId": "{pluginId}",
  "isEnabled": true
}
```

If you omit a plugin ID, the system falls back to the bundled default plugin for that stage.

### Other data feed endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/v1/datafeed` | List all feeds |
| GET | `/api/v1/datafeed?isEnabled=1` | List enabled feeds |
| PUT | `/api/v1/datafeed/update/{dataFeedId}` | Update feed config |
| DELETE | `/api/v1/datafeed/delete/{dataFeedId}` | Delete feed |

---

## Sending Data

Upload a file to the pipeline:

```
POST /api/v1/processor/process-feed
Content-Type: application/json
Authorization: Bearer {token}
X-DataFeed-Id: {dataFeedId}
```

The request body is the raw data to process. The content type determines how the file is stored:

**Supported content types:**
`application/json`, `application/jsonl`, `application/fhir+json`, `application/fhir+xml`, `application/hl7-v2`, `application/xml`, `text/csv`, `text/plain`, `text/tab-separated-values`, `application/octet-stream`, `application/pdf`, `image/jpeg`, `image/png`

**Query parameters:**

| Parameter | Description |
|-----------|-------------|
| `force=true` | Skip deduplication, reprocess even if same file was uploaded before |

**Response:**

```json
{
  "message": "Message successfully processed.",
  "messageId": "0226dbb8-53a8-4993-92db-db563e945d3e",
  "deduplicated": false,
  "contentType": "application/json",
  "size": 3956,
  "userId": "...",
  "projectId": "..."
}
```

### Example: sending canonical JSON with curl

```bash
curl -X POST http://localhost:9080/api/v1/processor/process-feed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-DataFeed-Id: $DATA_FEED_ID" \
  -d @my-lab-data.json
```

---

## Canonical JSON Format

When using the **default schema plugin**, the input must already be in canonical format. This is the standard record structure that all plugins ultimately produce:

```json
{
  "patient": { ... },
  "lab_request": { ... },
  "lab_results": [ ... ],
  "isolates": [ ... ],
  "susceptibility_tests": [ ... ]
}
```

### Minimal example (chemistry result)

```json
{
  "lab_request": {
    "request_id": "LAB-2024-001",
    "facility_code": {
      "concept_code": "FAC001",
      "display_name": "Central Lab",
      "concept_class": "facility",
      "datatype": "coded"
    }
  },
  "lab_results": [
    {
      "obx_sub_id": 1,
      "observation_code": {
        "concept_code": "GLU",
        "display_name": "Glucose",
        "concept_class": "test",
        "datatype": "coded"
      },
      "result_value": "5.4",
      "result_type": "NM",
      "numeric_value": 5.4,
      "numeric_units": "mmol/L",
      "is_resulted": true
    }
  ],
  "isolates": [],
  "susceptibility_tests": []
}
```

**Notes:**
- `patient` is optional (some countries restrict patient-level data)
- `lab_request.request_id` is required
- `lab_results` must be an array
- `isolates` and `susceptibility_tests` can be empty arrays for non-AMR data

### Full example (AMR with susceptibility)

See [canonical-full.json](../apps/openldr-minio/config/test-files/canonical-full.json) for a complete example with patient, culture results, isolates, and susceptibility tests.

---

## Concept Objects

Many fields use **concept objects** to identify coded values. These are resolved into the terminology system during the mapping stage.

```json
{
  "system_id": "DEFAULT_TEST",
  "concept_code": "WBC",
  "display_name": "White Blood Cell Count",
  "concept_class": "test",
  "datatype": "coded",
  "properties": {}
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `concept_code` | Yes | The code from the source system |
| `display_name` | Yes | Human-readable name |
| `concept_class` | Yes | Category: `facility`, `panel`, `specimen`, `test`, `organism`, `antibiotic` |
| `datatype` | No | Default: `coded` |
| `system_id` | No | Coding system namespace. If omitted, the default schema plugin assigns one automatically |
| `properties` | No | Extra key-value metadata |

### Default coding systems

When `system_id` is omitted, the default schema plugin assigns these:

| Concept field | Default system_id |
|---------------|------------------|
| `facility_code` | `DEFAULT_FACILITY` |
| `panel_code` | `DEFAULT_TEST` |
| `specimen_code` | `DEFAULT_SPEC` |
| `observation_code` (lab_results) | `DEFAULT_TEST` |
| `organism_code` (isolates) | `DEFAULT_ORG` |
| `antibiotic_code` (susceptibility_tests) | `DEFAULT_ABX` |

Custom schema plugins define their own namespaces (e.g., `WHONET_TEST`, `DISA_FAC`).

---

## Monitoring and Troubleshooting

### Check message status

```
GET /api/v1/processor/messages/{messageId}/status
```

```json
{
  "messageId": "...",
  "status": "success",
  "currentStage": "outpost",
  "paths": {
    "raw": "bucket/raw/...",
    "validated": "bucket/validated/...",
    "mapped": "bucket/mapped/...",
    "processed": "bucket/processed/..."
  },
  "error": null,
  "createdAt": "...",
  "completedAt": "..."
}
```

### View processing events

```
GET /api/v1/processor/messages/{messageId}/events
```

Returns a timeline of every stage the message passed through, including plugin names, timestamps, and any errors.

### Common errors

| Error Code | Stage | Cause |
|-----------|-------|-------|
| `UNKNOWN_CODING_SYSTEM` | validation | The `system_id` values in concept objects don't exist in the `coding_systems` table. Insert them or omit `system_id` to use defaults. |
| `SCHEMA_VALIDATION_FAILED` | validation | The message failed `validate()`. Check `details.errors` for specifics. |
| `EXTERNAL_PERSISTENCE_FAILED` | storage | Database insert failed. Common cause: field value exceeds column size (e.g., `priority` must be a single character). |
| `OUTPOST_PLUGIN_FAILED` | outpost | The outpost plugin's `process()` threw an error. |

### Dead-letter queues

Failed messages land in Kafka DLQ topics:

- `raw-inbound-dead-letter`
- `validated-inbound-dead-letter`
- `mapped-inbound-dead-letter`
- `processed-inbound-dead-letter`

Each DLQ message includes the original payload, the error details, and plugin selection info for debugging.

---

## Default Plugins

OpenLDR ships with four bundled default plugins that handle canonical JSON passthrough:

| Plugin | File | Behavior |
|--------|------|----------|
| `default-schema` | `default-plugins/schema/default.schema.js` | Validates canonical structure, assigns `obr_set_id` and default `system_id` values |
| `default-mapper` | `default-plugins/mapper/default.mapper.js` | Pass-through (no terminology transformation) |
| `default-storage` | `default-plugins/storage/default.storage.js` | Counts records, returns success (persistence is handled by the pipeline) |
| `default-outpost` | `default-plugins/outpost/default.outpost.js` | No-op (no downstream push) |

These are used when no custom plugin is assigned to a data feed, or as fallbacks when a custom plugin fails to load.

---

## Field Reference

### lab_request

| Field | Type | Constraint | Description |
|-------|------|-----------|-------------|
| `request_id` | string | **required** | Unique ID for this request |
| `obr_set_id` | integer | auto-assigned | Distinguishes multiple records sharing a `request_id` |
| `facility_code` | concept | | Facility where test was performed |
| `panel_code` | concept | | Test panel / order code |
| `specimen_code` | concept | | Specimen type |
| `taken_datetime` | ISO 8601 | | Specimen collection time |
| `collected_datetime` | ISO 8601 | | Alias for `taken_datetime` |
| `received_at` | ISO 8601 | | When specimen arrived at lab |
| `registered_at` | ISO 8601 | | Registration time |
| `analysis_at` | ISO 8601 | | Analysis start time |
| `authorised_at` | ISO 8601 | | Result authorization time |
| `clinical_info` | string | | Clinical notes |
| `icd10_codes` | string | | ICD-10 diagnosis codes |
| `therapy` | string | | Current therapy |
| `priority` | char(1) | `S`, `R`, `A` | HL7 priority: Stat / Routine / ASAP |
| `age_years` | integer | | Patient age in years at time of request |
| `age_days` | integer | | Patient age in days (for infants) |
| `sex` | char(1) | `M`, `F`, `U` | Patient sex |
| `patient_class` | char(1) | `I`, `O`, `E` | Inpatient / Outpatient / Emergency |
| `section_code` | varchar(10) | | Lab section: `CH`, `HM`, `MB`, etc. |
| `result_status` | char(1) | `F`, `P`, `C` | Final / Preliminary / Corrected |
| `requesting_facility` | string | | Ordering facility or ward |
| `testing_facility` | string | | Lab that performed the test |
| `requesting_doctor` | string | | Ordering clinician |
| `tested_by` | string | | Lab technician |
| `authorised_by` | string | | Authorizing clinician |
| `source_payload` | object | | Plugin-specific extra data |

### lab_results (array)

| Field | Type | Description |
|-------|------|-------------|
| `obx_sub_id` | integer | Sub-observation ID (usually `1`) |
| `observation_code` | concept | What was observed |
| `result_value` | string | Raw result as reported |
| `result_type` | string | `NM` (numeric), `CE` (coded), `ST` (string) |
| `numeric_value` | number | Parsed number (when `NM`) |
| `coded_value` | string | Code value (when `CE`) |
| `text_value` | string | Free text (when `ST`) |
| `numeric_units` | string | Units (e.g., `mmol/L`) |
| `abnormal_flag` | string | `H`, `L`, `HH`, `LL`, `A`, `N` |
| `rpt_units` | string | Reporting units |
| `rpt_flag` | string | Reporting flag |
| `rpt_range` | string | Reference range (e.g., `4.0-11.0`) |
| `result_timestamp` | ISO 8601 | When result was finalized |
| `isolate_index` | integer | Links to isolate (AMR only) |
| `is_resulted` | boolean | Whether a result value exists |

### isolates (array, AMR only)

| Field | Type | Description |
|-------|------|-------------|
| `isolate_index` | integer | 1-based, unique within record |
| `organism_code` | concept | Organism identification |
| `organism_type` | string | `bacteria`, `fungus`, `virus`, `parasite` |
| `isolate_number` | string | Isolate sequence number |
| `serotype` | string | Serotype if applicable |
| `patient_age_days` | integer | Age in days (for AMR analytics) |
| `patient_sex` | char(1) | `M`, `F`, `U` |
| `ward` | string | Ward name |
| `ward_type` | string | `in`, `out`, `er` |
| `origin` | string | `h` (hospital), `c` (community) |
| `beta_lactamase` | string | Beta-lactamase result |
| `esbl` | string | ESBL result |
| `carbapenemase` | string | Carbapenemase result |
| `mrsa_screen` | string | MRSA screening result |
| `inducible_clinda` | string | Inducible clindamycin result |

### susceptibility_tests (array, AMR only)

| Field | Type | Description |
|-------|------|-------------|
| `isolate_index` | integer | Must match an isolate's `isolate_index` |
| `antibiotic_code` | concept | Antibiotic tested |
| `test_method` | string | `DISK` or `MIC` |
| `disk_potency` | string | Disk strength (e.g., `30`) |
| `result_raw` | string | Original value (e.g., `22`, `<=0.5`) |
| `result_numeric` | number | Parsed numeric value |
| `susceptibility_value` | string | Interpretation: `S`, `I`, `R`, `SDD`, `NS` |
| `guideline` | string | `CLSI`, `EUCAST`, etc. |
| `guideline_version` | string | Year or version |

### patient (optional)

| Field | Type | Description |
|-------|------|-------------|
| `patient_guid` | string | Unique patient ID from source system |
| `firstname` | string | |
| `middlename` | string | |
| `surname` | string | |
| `sex` | char(1) | `M`, `F`, `U`, `O` |
| `folder_no` | string | Hospital folder/chart number |
| `date_of_birth` | ISO date | `YYYY-MM-DD` |
| `phone` | string | |
| `email` | string | |
| `national_id` | string | |
| `patient_data` | object | Extra fields stored as JSONB |
