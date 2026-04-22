# OpenLDR v2 Extension Plugin Guide

## Overview

OpenLDR v2 uses a plugin architecture to ingest data from different laboratory systems. Each plugin is a set of four JavaScript files that run inside a sandboxed VM. The pipeline calls specific entry-point functions on each plugin type:

| Plugin Type | Entry Points | Purpose |
|-------------|-------------|---------|
| **Schema** | `validate(message)`, `convert(message)` | Parse raw data, validate structure, convert to canonical records |
| **Mapper** | `map(message)` | Terminology normalization (often pass-through) |
| **Storage** | `process(message)` | Record counting and pre-persistence checks |
| **Outpost** | `process(message)` | Push to downstream systems (often no-op) |

## Directory Structure

```
openldr-ext-{name}/
├── plugins/
│   ├── schema/{name}.schema.js      # Validation & conversion
│   ├── mapper/{name}.mapper.js      # Terminology mapping
│   ├── storage/{name}.storage.js    # Record counting
│   ├── outpost/{name}.outpost.js    # Downstream integration
│   └── build-plugins.cjs            # Build & obfuscation script
├── src/
│   └── resources/                   # Reference data files (if needed)
└── package.json
```

## Pipeline Flow

```
Raw Message → Schema.validate() → Schema.convert()
                                        ↓
                              [Array of canonical records]
                                        ↓
                              (each record processed independently)
                                        ↓
                              Mapper.map() → concept resolution
                                        ↓
                              Storage.process() → DB persistence
                                        ↓
                              Outpost.process()
```

**Important:** `convert()` can return multiple records. Each record flows through the pipeline independently — it gets its own Kafka message, its own DB transaction. Records cannot reference each other.

---

## Canonical Record Structure

Every record returned by `convert()` must follow this structure:

```javascript
{
  patient: { ... },
  lab_request: { ... },
  lab_results: [ ... ],
  isolates: [ ... ],              // AMR only — empty array if not applicable
  susceptibility_tests: [ ... ],  // AMR only — empty array if not applicable
  _metadata: { facility: { ... } },
  _plugin: {
    plugin_name: 'my-schema',
    plugin_version: '1.0.0',
    source_system: 'MyLIS'
  }
}
```

### patient

```javascript
{
  patient_guid: string,           // REQUIRED — unique patient ID from source
  firstname: string | null,
  middlename: string | null,
  surname: string | null,
  sex: 'M' | 'F' | 'U',
  folder_no: string | null,       // Hospital folder/chart number
  date_of_birth: string | null,   // ISO date (YYYY-MM-DD)
  phone: string | null,
  email: string | null,
  national_id: string | null,
  patient_data: { ... }           // Any extra fields as JSONB
}
```

### lab_request

```javascript
{
  request_id: string,             // REQUIRED — unique per facility (see Request ID section)
  obr_set_id: number,            // Assigned by convert() — see OBR Set ID section
  facility_code: concept,         // REQUIRED — asConcept(SYSTEMS.FACILITY, ...)
  panel_code: concept | null,     // Test/panel identification
  specimen_code: concept | null,  // Specimen type

  // Timestamps
  taken_datetime: string | null,       // Specimen collection
  collected_datetime: string | null,   // Same as taken_datetime (alias)
  received_at: string | null,          // Received in lab
  registered_at: string | null,
  analysis_at: string | null,
  authorised_at: string | null,

  // Clinical context
  clinical_info: string | null,
  icd10_codes: string | null,
  therapy: string | null,
  priority: string | null,

  // Patient snapshot at time of request
  age_years: number | null,
  age_days: number | null,
  sex: 'M' | 'F' | 'U' | null,
  patient_class: 'I' | 'O' | 'E' | null,  // Inpatient/Outpatient/Emergency

  // Lab metadata
  section_code: string | null,         // 'CH'=chemistry, 'HM'=haem, 'MB'=micro
  result_status: 'F' | 'P' | 'C' | null,  // Final/Preliminary/Corrected

  // Personnel
  requesting_facility: string | null,
  testing_facility: string | null,
  requesting_doctor: string | null,
  tested_by: string | null,
  authorised_by: string | null,

  source_payload: { ... }             // Plugin-specific extras
}
```

### lab_results (array)

Each entry is one observation/test result:

```javascript
{
  source_test_code: string | null,    // Source system's test code
  obx_sub_id: 1,                     // Always 1 for single-field observations
  observation_code: concept,          // What was observed — asConcept(...)

  // Values — set the appropriate ones based on result_type
  result_value: string,               // Raw value as reported
  result_type: 'NM' | 'CE' | 'ST',   // Numeric / Coded / String
  numeric_value: number | null,       // Parsed number (when result_type = 'NM')
  coded_value: string | null,         // Code like 'R', 'S', 'I', or organism name
  text_value: string | null,          // Free text (when result_type = 'ST')

  // Optional
  numeric_units: string | null,       // e.g., 'mm', 'ug/mL'
  abnormal_flag: string | null,       // 'H', 'L', 'HH', 'LL', 'A', 'N'
  rpt_units: string | null,
  rpt_flag: string | null,
  rpt_range: string | null,
  result_timestamp: string | null,    // When result was finalized

  // Metadata
  isolate_index: number | null,       // Set on organism results to link to isolate
  is_resulted: boolean,
  raw_result: object                  // Original source data
}
```

### isolates (array) — AMR only

```javascript
{
  isolate_index: number,              // 1-based, unique within the record
  source_test_code: string | null,
  organism_code: concept,             // asConcept(SYSTEMS.ORG, code, name, 'organism', 'coded')

  // Organism details
  organism_type: string | null,       // 'bacteria', 'fungus', 'virus', 'parasite'
  isolate_number: string | null,
  serotype: string | null,

  // Clinical context (denormalized for AMR analytics)
  patient_age_days: number | null,
  patient_sex: 'M' | 'F' | 'U' | null,
  ward: string | null,
  ward_type: string | null,           // 'in', 'out', 'er'
  origin: string | null,              // 'h' (hospital), 'c' (community)

  // Resistance markers
  beta_lactamase: string | null,
  esbl: string | null,
  carbapenemase: string | null,
  mrsa_screen: string | null,
  inducible_clinda: string | null,

  custom_fields: object | null,
  raw_result: object
}
```

### susceptibility_tests (array) — AMR only

```javascript
{
  isolate_index: number,              // Must match an isolate's isolate_index
  source_test_code: string | null,
  antibiotic_code: concept,           // asConcept(SYSTEMS.ABX, code, name, 'antibiotic', 'coded')

  test_method: 'DISK' | 'MIC' | null,
  disk_potency: string | null,        // e.g., '30', '10'

  result_raw: string | null,          // Original value: '22', '<=0.5', 'R'
  result_numeric: number | null,      // Parsed numeric
  susceptibility_value: string | null,// Interpretation: 'S', 'I', 'R', 'SDD', 'NS'
  quantitative_value: string | null,

  guideline: string | null,           // 'CLSI', 'EUCAST', etc.
  guideline_version: string | null,   // Year or version

  raw_result: object
}
```

---

## Required Utility Functions

Every schema plugin needs these three functions:

```javascript
function normalizeText(value) {
  if (value === null || value === undefined) return null;
  var text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

function normalizeCode(value) {
  var text = normalizeText(value);
  return text ? text.toUpperCase() : null;
}

function asConcept(system_id, concept_code, display_name, concept_class, datatype, properties) {
  var normalizedCode = normalizeCode(concept_code);
  if (!normalizedCode) return null;
  return {
    system_id: system_id,
    concept_code: normalizedCode,
    display_name: normalizeText(display_name) || normalizedCode,
    concept_class: concept_class,
    datatype: datatype || 'coded',
    properties: properties || {},
  };
}
```

---

## SYSTEMS Constants

Each plugin defines its own coding system namespace. The backend creates entries in `coding_systems` and `concepts` tables automatically.

```javascript
// WHONET example
var SYSTEMS = {
  FACILITY: 'WHONET_FAC',
  TEST:     'WHONET_TEST',
  SPECIMEN: 'WHONET_SPEC',
  ORG:      'WHONET_ORG',
  ABX:      'WHONET_ABX',
};

// DISA example
var SYSTEMS = {
  FACILITY: 'DISA_FAC',
  TEST:     'DISA_TEST',
  RESULT:   'DISA_RESULT',
  SPECIMEN: 'DISA_SPEC',
  ORG:      'DISA_ORG',
  ABX:      'DISA_ABX',
};
```

Convention: `{SYSTEM}_{TYPE}` — keeps concepts from different sources separated.

---

## Request ID

The `request_id` must be unique per facility. Since source systems often reuse IDs, build a composite key:

```
{SYSTEM}_{unique components from source data}
```

**WHONET example:** `WHONET_254_ETH_08_293878_6820_2024-07-22`
- Prefix: `WHONET_`
- ROW_IDX: unique per row in the file
- COUNTRY_A + LABORATORY + PATIENT_ID + SPEC_NUM + SPEC_DATE

**DISA example:** `DISA_{LabNumber}` (already globally unique in DISA*Lab)

The `request_id` + `obr_set_id` + `facility_id` forms the unique constraint in `lab_requests`.

---

## OBR Set ID

When `convert()` returns multiple records sharing the same `request_id`, each needs a unique `obr_set_id`. Assign it after building all records:

```javascript
// At the end of convert(), before returning results:
var obrCounters = {};
for (var j = 0; j < results.length; j++) {
  var reqId = results[j].lab_request.request_id || '';
  if (!obrCounters[reqId]) obrCounters[reqId] = 0;
  obrCounters[reqId] += 1;
  results[j].lab_request.obr_set_id = obrCounters[reqId];
}
```

---

## Organism + Lab Results Pattern (AMR)

For AMR data, the organism must appear as both:
1. An **isolate** (in the `isolates` array) — for the `isolates` table
2. A **lab_result** (in the `lab_results` array) — as a WHONET_ORG observation in `lab_results` table

The backend detects organism lab_results by checking `_resolved_concepts` for a system_id containing "ORG". When found, it skips creating a duplicate backing result for the isolate.

**Each record processed independently needs its own isolate.** If you split one source row into N records (one per antibiotic), every record must include the isolate — not just the first one.

---

## Multi-Test Messages (DISA pattern)

Some source systems (like DISA\*Lab) send a single message containing multiple test orders and results (e.g., microbiology culture + sensitivity + biochemical tests). In this case, `convert()` should return **one record per test result**, not one combined record.

### Why one record per test?
- Each test needs its own `panel_code` in `lab_requests` (e.g., MRCSW, MSENS, MICBM)
- The `obr_set_id` distinguishes them within the same `request_id`
- Not all tests produce isolates or susceptibility data — biochemical tests are lab_results only

### Ordering by TESTINDEX
When the source provides an ordering field (e.g., `TESTINDEX` in DISA), sort the test results before processing so `obr_set_id` values match the source order:

```javascript
var testResults = (message.TestResults || []).slice();
testResults.sort(function (a, b) {
  return (a.TESTINDEX || 0) - (b.TESTINDEX || 0);
});
```

### Isolate sharing across test results
Collect isolates in a **first pass** across all test results, then reference them by index in each record. The same organism found in a culture test (e.g., MRCSW) and a sensitivity test (e.g., MSENS) should deduplicate to one isolate entry shared across records.

### Filtering non-resulted entries
Only include entries where `IsResulted` is true. Source systems often include template/placeholder entries for tests that were not performed — these should not create `lab_results` rows.

### Handling truncated descriptions
DISA\*Lab truncates field descriptions (e.g., `"arks"` instead of `"Remarks"`). Use `sanitizeDisplayName()` to detect and reject fragments — fall back to the parameter code when the description starts with a lowercase letter.

---

## Module Exports

Every plugin file must export using CommonJS:

```javascript
// Schema
module.exports = {
  name: 'my-schema',
  version: '1.0.0',
  status: 'active',
  validate: validate,
  convert: convert
};

// Mapper
module.exports = {
  name: 'my-mapper',
  version: '1.0.0',
  status: 'active',
  map: map
};

// Storage & Outpost
module.exports = {
  name: 'my-storage',  // or 'my-outpost'
  version: '1.0.0',
  status: 'active',
  process: process
};
```

---

## Minimal Mapper (Pass-Through)

```javascript
function map(message) {
  return { transformedMessage: message };
}

module.exports = { name: 'my-mapper', version: '1.0.0', status: 'active', map: map };
```

---

## Minimal Storage

```javascript
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
    notes: [],
    processing_completed: new Date().toISOString(),
  };
}

module.exports = { name: 'my-storage', version: '1.0.0', status: 'active', process: process };
```

---

## Minimal Outpost (No-Op)

```javascript
function process(message) {
  return {
    success: true,
    action: 'noop',
    notes: ['No downstream push configured'],
    processed_at: new Date().toISOString(),
  };
}

module.exports = { name: 'my-outpost', version: '1.0.0', status: 'active', process: process };
```

---

## Build & Obfuscation

Install `javascript-obfuscator` as a dev dependency, then create `build-plugins.cjs`:

```javascript
const JavaScriptObfuscator = require('javascript-obfuscator');
// Read source → obfuscate → write to dist/
// Reserve these names: validate, convert, map, process, module, exports, name, version, status
```

For plugins with resource data (like WHONET's Breakpoints.txt), inject the file contents as string constants before obfuscation using placeholder replacement:

```javascript
var MY_DATA = '%%MY_DATA%%';  // Replaced at build time
```

---

## Backend Column Reference

The backend accepts **all** columns from the DB schema. Set fields to `null` when your plugin doesn't have the data — the backend defaults everything to null.

### lab_results columns
`obx_set_id`, `obx_sub_id`, `observation_concept_id`, `observation_code`, `observation_system`, `observation_desc`, `result_type`, `numeric_value`, `numeric_units`, `numeric_lo_range`, `numeric_hi_range`, `coded_value`, `text_value`, `datetime_value`, `abnormal_flag`, `rpt_result`, `rpt_units`, `rpt_flag`, `rpt_range`, `semiquantitative`, `work_units`, `cost_units`, `result_timestamp`, `result_data`

### isolates columns
`organism_concept_id`, `organism_code`, `organism_name`, `specimen_concept_id`, `specimen_code`, `specimen_date`, `isolate_number`, `serotype`, `organism_type`, `beta_lactamase`, `esbl`, `carbapenemase`, `mrsa_screen`, `inducible_clinda`, `patient_age_days`, `patient_sex`, `ward`, `ward_type`, `origin`, `prior_antibiotics`, `custom_fields`, `raw_data`

### susceptibility_tests columns
`antibiotic_concept_id`, `antibiotic_code`, `antibiotic_name`, `test_method`, `disk_potency`, `result_raw`, `result_numeric`, `interpretation`, `guideline`, `guideline_version`

---

## Checklist for New Plugins

- [ ] Define `SYSTEMS` constants with unique namespace prefix
- [ ] Implement `normalizeText()`, `normalizeCode()`, `asConcept()`
- [ ] `validate()` returns `{ valid, reason, details }`
- [ ] `convert()` returns an **array** of canonical records
- [ ] Each record has `patient`, `lab_request`, `lab_results`, `isolates`, `susceptibility_tests`, `_metadata`, `_plugin`
- [ ] `request_id` is composite and globally unique (prefixed with system name)
- [ ] `obr_set_id` assigned per `request_id` group in `convert()`
- [ ] Every record that has `susceptibility_tests` also has matching `isolates`
- [ ] Organism appears in both `isolates` array AND `lab_results` array (for AMR)
- [ ] Only resulted entries are included in `lab_results` (skip `IsResulted: false`)
- [ ] Multi-test messages produce one record per test (each with own `panel_code`)
- [ ] Test results sorted by source ordering field before processing (e.g., `TESTINDEX`)
- [ ] Truncated/garbled descriptions fall back to the parameter code
- [ ] All code is ES5-compatible (`var`, no optional chaining, no `Map`/`Set`/`for-of`)
- [ ] `module.exports` has `name`, `version`, `status`, and the entry-point functions
- [ ] Mapper, storage, and outpost plugins created (can be minimal)
- [ ] Build with `javascript-obfuscator` produces working obfuscated output
- [ ] Test obfuscated plugins via `vm.runInNewContext` to verify sandbox compatibility
