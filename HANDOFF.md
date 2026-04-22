# WHONET Tool Extension — Handoff

## What This Extension Does

An OpenLDR iframe extension that runs WHONET AMR (Antimicrobial Resistance) analysis entirely in-browser. Users upload a WHONET SQLite database file and can:

1. **View isolate data** — preview rows, columns, record counts
2. **Run AMR interpretation** — assign R/I/S classifications using CLSI/EUCAST breakpoints via the ported AMR engine
3. **Run GLASS analysis** — full GLASS pipeline producing RIS aggregation and isolate summary tables
4. **Export results** — CSV export per table, SQLite export for GLASS output

## Architecture

- **Single-file bundle** — Vite builds `src/main.ts` into an IIFE, injected into `dist/index.html`. The host loads this in a sandboxed iframe.
- **No external dependencies at runtime** — all resources (breakpoint tables, WASM binary) are inlined at build time:
  - AMR resource files (Breakpoints.txt ~5MB, Organisms.txt, Antibiotics.txt, etc.) via Vite `?raw` imports
  - sql.js WASM binary via custom `?binary` Vite plugin (base64-encoded in bundle)
- **sql.js** for SQLite — pure JS/WASM SQLite, no separate `.wasm` file to serve. A `CompatDatabase` adapter (`src/lib/sqlite-compat.ts`) wraps sql.js to match the `@sqlite.org/sqlite-wasm` `.exec()` API the lib/ code expects.
- **Vanilla DOM UI** — no framework, uses a `h(tag, props, ...children)` helper with a central `state` object and `render()` cycle.
- **Batched processing** — AMR interpretation runs in chunks of 500 records with `setTimeout` yields to keep the UI responsive.

## Key Files — Extension (iframe)

| File                                          | Role                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/main.ts`                                 | Entry point — UI, state management, orchestration                                   |
| `src/lib/processors/JSONProcessor.ts`         | AMR interpretation entry point (`interpret()` / `interpretSingle()`)                |
| `src/lib/processors/Processor.ts`             | Core processing loop — breakpoint cache preheat, per-isolate interpretation         |
| `src/lib/amr_engine/BrowserResourceLoader.ts` | Seeds resource cache from inline `?raw` imports                                     |
| `src/lib/amr_engine/`                         | Full AMR engine (breakpoints, organisms, antibiotics, expert rules)                 |
| `src/lib/whonet/glass/DirectAnalysis.ts`      | GLASS pipeline — `runAllGlassAnalyses()` entry point                                |
| `src/lib/whonet/`                             | Full WHONET analysis engine (RunAnalysis, routines, exports, reports)               |
| `src/lib/sqlite-compat.ts`                    | sql.js → @sqlite.org/sqlite-wasm compatibility adapter                              |
| `src/lib/db.ts`                               | SQLite utility functions (table listing, schema, data queries)                      |
| `src/resources/`                              | AMR resource text files + sql-wasm.wasm (inlined at build)                          |
| `vite.config.ts`                              | Build config — `@/` alias, `path-browserify`, `?binary` plugin, CSP, HTML injection |
| `manifest.json`                               | Extension metadata for OpenLDR host                                                 |
| `pack.mjs`                                    | Creates `dist/extension.zip` for upload                                             |

## Key Files — Plugins (data-processing pipeline)

| File                                | Role                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `plugins/schema/whonet.schema.js`   | Format detection, parsing (SQLite/JSON/JSONL/CSV), AMR interpretation, canonical record conversion |
| `plugins/mapper/whonet.mapper.js`   | Pass-through / terminology normalization                                                           |
| `plugins/storage/whonet.storage.js` | Persist canonical records to OpenLDR database                                                      |
| `plugins/outpost/whonet.outpost.js` | No-op (future: push to external systems)                                                           |

## Pipeline Status: Fully Operational (2026-03-27)

The full 4-stage pipeline (validation → mapping → storage → outpost) is working end-to-end. Tested with a 5MB WHONET SQLite file containing 27,984 isolate rows — all records processed successfully through all stages and persisted to `openldr_external`.

## Live-Run Progress UX (2026-03-30)

Redesigned the live-run event feed to fix three UX problems:

1. **Stage-based rows** — replaced the chronological event list with one row per pipeline stage. Failures appear inline with their stage instead of as a confusing late entry after storage completed.
2. **Global persistence** — live-run state lifted from `usePluginTest` into a `LiveRunContext` so progress survives page navigation. A footer indicator ("1 run active" / "Run completed" / "Run failed") is visible on every page and opens a right-sliding Sheet with the full stage progress view.
3. **Staleness detection** — if no events arrive for 15s+ the UI shows "last event Xs ago"; after 30s+ it escalates to an amber warning "Pipeline may be stalled".

### Key Files (2026-03-30)

| File                                                                    | Role                                                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/openldr-studio/src/contexts/LiveRunContext.tsx`                   | Global context, provider, polling, terminal detection, staleness timer |
| `apps/openldr-studio/src/components/projects/StageProgressView.tsx`     | Stage-based progress display (replaces `LiveEventFeed`)                |
| `apps/openldr-studio/src/components/projects/LiveRunSheet.tsx`          | Right-sliding Sheet wrapping StageProgressView                         |
| `apps/openldr-studio/src/components/admin-panel/FooterRunIndicator.tsx` | Clickable run status badge in the global footer                        |
| `apps/openldr-studio/src/pages/MainPage.tsx`                            | Wraps app with `LiveRunProvider`, mounts `LiveRunSheet`                |
| `apps/openldr-studio/src/components/admin-panel/admin-panel-layout.tsx` | Added `FooterRunIndicator` to footer                                   |
| `apps/openldr-studio/src/hooks/misc/usePluginTest.ts`                   | Removed local live-run state; uses `onLiveRunStart` callback           |
| `apps/openldr-studio/src/pages/ProjectsPage.tsx`                        | Wired up `useLiveRun()` context + `StageProgressView`                  |

### Bugs Fixed (2026-03-30)

- **Premature terminal detection**: a single validation failure stopped polling while 27k+ records were still flowing through the pipeline. Now waits for all validated records to reach the final stage.
- **Stale event counts**: poll comparison used `events.length` which stays constant for aggregated events — switched to snapshot of `stage:status:count` tuples.
- **Mid-run failure visibility**: footer and sheet now show "Running (errors)" with pulsing red dot when failures occur before the run is complete.

## Dashboard Infrastructure Performance (2026-03-30)

The `/infrastructure` endpoint took 85s because `getStorageOverview()` lists all MinIO objects (600k+) to count them. Split into two endpoints:

- `/api/v1/dashboard/infrastructure` — pipeline, services, databases (fast, <1s)
- `/api/v1/dashboard/infrastructure/storage` — MinIO bucket stats (slow, cached 5min TTL)

The frontend fires both in parallel; the dashboard renders instantly with a spinner in the storage card until MinIO finishes.

### Key Files (2026-03-30)

| File                                                                   | Change                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/openldr-entity-services/src/controllers/dashboard.controller.ts` | Added `/infrastructure/storage` endpoint                                                                     |
| `apps/openldr-entity-services/src/services/dashboard.service.ts`       | Removed storage from `getInfraDashboard`, added 5min TTL cache, standalone DB connection for name resolution |
| `apps/openldr-studio/src/lib/restClients/dashboardRestClient.tsx`      | Added `getInfraStorage()` client function                                                                    |
| `apps/openldr-studio/src/hooks/misc/useDashboard.ts`                   | Non-blocking storage fetch alongside infrastructure                                                          |
| `apps/openldr-studio/src/pages/DashboardPage.tsx`                      | Loading spinner for storage card                                                                             |

## Pipeline Storage Deduplication (2026-03-31)

Uploading a 5.3MB WHONET SQLite file (~27k rows) 13 times consumed 13GB in MinIO. Each run creates ~81k objects across 4 pipeline stages (raw/validated/mapped/processed × ~27k records). No deduplication at ingestion, no cleanup of intermediate objects.

### Phase 1: Hash-on-Ingest Dedup

Skip re-processing identical files. Compute SHA-256 of incoming file, check a `file_hashes` lookup table — if already ingested for this data feed, return existing `messageId` with `{ deduplicated: true }`, skip MinIO put + Kafka publish.

- [x] **Task 13: `file_hashes` table migration** — columns: `hash` (SHA-256, PK), `message_id`, `data_feed_id`, `project_id`, `created_at`
- [x] **Task 14: Ingest dedup logic** — hash `req.body`, query lookup table, short-circuit if match, insert hash after successful MinIO put

| File                                                                         | Change                               |
| ---------------------------------------------------------------------------- | ------------------------------------ |
| `apps/openldr-data-processing/src/controllers/data.processing.controller.ts` | Hash check before MinIO upload       |
| `apps/openldr-data-processing/src/services/minio.service.ts`                 | Reuse existing `calculateFileHash()` |
| New migration file                                                           | `file_hashes` table                  |

### Phase 2: MinIO Lifecycle Policies

Auto-expire intermediate objects to reclaim space. Apply lifecycle rules when ensuring bucket exists.

- [x] **Task 15: Lifecycle rules** — `raw/*` 7d, `validated/*` 3d, `mapped/*` 3d, `processed/*` 90d via `minioClient.setBucketLifecycle()`
- [x] **Task 16: Configurable TTLs** — environment variables with sensible defaults

| File                                                         | Change                                  |
| ------------------------------------------------------------ | --------------------------------------- |
| `apps/openldr-data-processing/src/services/minio.service.ts` | `setBucketLifecycle()` on bucket ensure |
| `apps/openldr-data-processing/.env`                          | TTL config vars                         |

### Phase 3: Source-Separated Architecture

Store source files once under `sources/{sha256hash}.{ext}`, make pipeline runs cheap references. A "run" is `{ runId, sourceHash, dataFeedId }` — re-running same source creates a new run without re-uploading.

- [x] **Task 17: Sources prefix** — upload to `sources/{hash}.{ext}`, HEAD check before write
- [x] **Task 18: Decouple run from source** — source stored once in `sources/`, `raw/` still used for pipeline (auto-expires via lifecycle)
- [x] **Task 19: Update validation handler** — no changes needed, pipeline still reads from `raw/` via Kafka webhook
- [x] **Task 20: Message tracking** — `startRun` metadata now includes `sourceHash` and `sourceObjectPath`

| File                                                                         | Change                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/openldr-data-processing/src/controllers/data.processing.controller.ts` | SHA-256 dedup check, `sources/` content-addressed upload, hash recording |
| `apps/openldr-data-processing/src/services/file-hash.service.ts`             | New — `hashBuffer()`, `findByHash()`, `insertHash()`, auto-creates table |
| `apps/openldr-data-processing/src/services/minio.service.ts`                 | Per-prefix lifecycle rules (raw/validated/mapped/processed/sources)      |
| `apps/openldr-data-processing/.env`                                          | `MINIO_TTL_*` env vars                                                   |
| `apps/openldr-internal-database/migrations/01-openldr.sql`                   | `fileHashes` table (hash+dataFeedId PK)                                  |

---

## Force Run for Deduplicated Uploads (2026-03-31)

When the same file is uploaded twice, dedup returns `deduplicated: true` and skips the pipeline. Users need a way to re-process (e.g., after plugin changes). A dialog prompts "Force Run" or "Cancel", and `?force=true` bypasses dedup on the backend.

- [x] **Task 32: Backend force flag** — `?force=true` query param skips dedup early-return; hash record upserted to point to latest run
- [x] **Task 33: Frontend force dialog** — `sendLiveRun` gets `force` param; ProjectsPage shows dedup confirmation dialog with Force Run / Cancel

| File                                                                         | Change                                  |
| ---------------------------------------------------------------------------- | --------------------------------------- |
| `apps/openldr-data-processing/src/controllers/data.processing.controller.ts` | Read `?force=true`, bypass dedup        |
| `apps/openldr-data-processing/src/services/file-hash.service.ts`             | Upsert hash on conflict                 |
| `apps/openldr-studio/src/lib/restClients/dataProcessingRestClient.tsx`       | `force` param on `sendLiveRun`          |
| `apps/openldr-studio/src/hooks/misc/usePluginTest.ts`                        | Return dedup result, add `forceRunLive` |
| `apps/openldr-studio/src/pages/ProjectsPage.tsx`                             | Dedup confirmation dialog               |

---

## Pipeline Runs Page (2026-03-31)

Dedicated operations page replacing the footer/sheet live-run monitor. Full paginated runs table, detail view, error inspection, retry/delete actions.

### Backend (apps/openldr-data-processing)

- [x] **Task 21: `listRuns` query** — paginated, filtered (status/project/feed/date), sorted, JOINs to projects/dataFeeds/fileHashes for names
- [x] **Task 22: `getRunDetail` + `softDeleteRun`** — combined run+events+fileHash detail; soft delete sets status='deleted'
- [x] **Task 23: MinIO cleanup utilities** — `deleteRunObjects(paths)` removes all stage objects for a run; `purgeObjectsByPrefix(bucket, prefix)` bulk-deletes by prefix
- [x] **Task 24: DLQ replay service** — reconstruct MinIO notification event from run record, publish to source topic, reset run status
- [x] **Task 25: Runs controller** — `GET /`, `GET /:messageId`, `POST /:messageId/retry`, `DELETE /:messageId`, `DELETE /objects/purge`; mounted at `/api/v1/runs`

| File                                       | Change                                               |
| ------------------------------------------ | ---------------------------------------------------- |
| `src/services/message.tracking.service.ts` | `listRuns()`, `getRunDetail()`, `softDeleteRun()`    |
| `src/services/minio.service.ts`            | `deleteRunObjects()`, `purgeObjectsByPrefix()`       |
| `src/services/dlq-replay.service.ts`       | New — Kafka producer replay from DLQ                 |
| `src/controllers/runs.controller.ts`       | New — all runs endpoints                             |
| `src/index.ts`                             | Mount `/api/v1/runs`                                 |
| `migrations/01-openldr.sql`                | Composite index on `(currentStatus, createdAt DESC)` |

### Frontend (apps/openldr-studio)

- [x] **Task 26: REST client + React Query hook** — `pipelineRunsRestClient.ts` (listRuns, getRunDetail, retryRun, deleteRun, purgeObjects); `usePipelineRuns.ts` hook with auto-refresh
- [x] **Task 27: Table columns** — status dot, messageId, project, feed, user, content type, size, mini stage progress, errors, started, duration
- [x] **Task 28: PipelineRunsPage** — ContentLayout + TanStack table + status filter + auto-refresh toggle + DataTablePagination
- [x] **Task 29: RunDetailSheet** — right-side Sheet reusing StageProgressView, metadata, object paths, error details, retry/delete action buttons
- [x] **Task 30: Routing + navigation** — route at `/pipeline-runs`, sidebar item in Settings group (next to Logs, icon: Activity)
- [x] **Task 31: Footer integration** — "View All" link in FooterRunIndicator → navigates to Pipeline Runs page

| File                                                | Change                     |
| --------------------------------------------------- | -------------------------- |
| `src/lib/restClients/pipelineRunsRestClient.ts`     | New — API client           |
| `src/hooks/misc/usePipelineRuns.ts`                 | New — React Query hooks    |
| `src/components/pipeline-runs/columns.tsx`          | New — TanStack column defs |
| `src/components/pipeline-runs/RunDetailSheet.tsx`   | New — detail Sheet         |
| `src/pages/PipelineRunsPage.tsx`                    | New — main page            |
| `src/main.tsx`                                      | Add route                  |
| `src/lib/menu-list.ts`                              | Add sidebar item           |
| `src/components/admin-panel/FooterRunIndicator.tsx` | Add "View All" link        |

---

## Completed Tasks

- [x] **Task 0** — Extension UI (completed in prior session)
- [x] **Task 1: Schema plugin** — format detection, AMR interpretation, canonical conversion
- [x] **Task 2: Pipeline upgrade** — multi-record support in validation handler
- [x] **Task 3: Mapper plugin** — pass-through
- [x] **Task 4: Storage plugin** — record counting and acknowledgment
- [x] **Task 5: Outpost plugin** — no-op
- [x] **Task 6: Database migration** — replaced `recipientPluginId` with `storagePluginId` + `outpostPluginId` in `dataFeeds` table
- [x] **Task 7: Data feed service** — `getDataFeedById()` returns `storagePlugin` and `outpostPlugin` objects
- [x] **Task 8: Pipeline handlers** — removed `recipientPluginId` fallback, storage/outpost use canonical field names
- [x] **Task 9: Studio UI** — 4-slot plugin dropdowns (validation, mapping, storage, outpost) with emerald color for storage
- [x] **Task 10: Plugin test API** — `upsertAssignment`/`getAssignment` use `storagePluginId`+`outpostPluginId`, `VALID_SLOTS` includes `"storage"`, plugin runner has storage stage
- [x] **Task 11: Binary file upload in test panel** — content type dropdown shows actual MIME types (text/binary grouped), binary types auto-switch to drag-and-drop file zone, dry-run sends multipart FormData with SQLite pre-conversion, live-run sends raw file bytes
- [x] **Task 12: Aggregated live-run events** — events API returns grouped counts instead of per-record rows, UI shows `Validation Completed (27,984)` instead of 27,984 individual lines

### Key Files Changed (2026-03-27)

| File                                                                        | Change                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/openldr-studio/src/pages/ProjectsPage.tsx`                            | MIME type dropdown (text/binary groups), file dropzone for binary types |
| `apps/openldr-studio/src/components/projects/LiveEventFeed.tsx`             | Aggregated event display with record counts                             |
| `apps/openldr-studio/src/hooks/misc/usePluginTest.ts`                       | File param on runTest/runLive, removed CONTENT_TYPE_MAP                 |
| `apps/openldr-studio/src/lib/restClients/pluginTestClient.tsx`              | FormData multipart for binary dry-run                                   |
| `apps/openldr-studio/src/lib/restClients/dataProcessingRestClient.tsx`      | File support for live-run, aggregated LiveEvent type                    |
| `apps/openldr-data-processing/src/controllers/projects.controller.ts`       | multer multipart on /run, SQLite pre-conversion (100 row limit)         |
| `apps/openldr-data-processing/src/lib/sqlite-convert.ts`                    | Shared `convertSqliteToJson()` with optional maxRows                    |
| `apps/openldr-data-processing/src/services/message.tracking.service.ts`     | Aggregated events query, `toBaseMessageId()`                            |
| `apps/openldr-data-processing/src/services/plugin.runner.service.ts`        | Plugin timeout increased to 120s                                        |
| `apps/openldr-data-processing/src/services/external-persistence.service.ts` | Facility code from `_resolved_concepts` fallback                        |

### Bugs Fixed This Session (2026-03-27)

- **Empty body on upload**: added 400 guard for empty uploads in controller
- **Empty source guard**: validation handler fails fast with `EMPTY_SOURCE_CONTENT` for 0-byte MinIO objects
- **UUID suffix crash**: `toBaseMessageId()` in message tracking service strips `__N` suffixes before PostgreSQL UUID queries
- **Coding system names**: `WHONET_FACILITY`/`WHONET_SPECIMEN` → `WHONET_FAC`/`WHONET_SPEC` to match DB seed data
- **Missing panel_code**: added `WHONET_TEST/AST` concept for `lab_request.panel_code`
- **nginx proxy_request_buffering**: set `on` for `/data-processing/` location to preserve body across `auth_request`
- **Facility persistence**: `upsertFacility` now extracts facility code from `_resolved_concepts` fallback (no plugin `_metadata` dependency)
- **Sex case**: `normalizeCode()` uppercases SEX values (m→M, f→F) to satisfy `patients_sex_check` constraint
- **Outpost plugin export**: changed from `run()` to `process()` to match `executeProcessPlugin` contract
- **Plugin API VALID_SLOTS**: added `"storage"` so `?slot=storage` API calls return storage plugins
- **Dry-run binary format detection**: pass `text/plain` contentType for pre-converted SQLite so plugin runner doesn't JSON.parse the string
- **Dry-run response too large**: limit SQLite pre-conversion to 100 rows for dry-run
- **Plugin timeout**: increased from 8s to 120s for large WHONET files with AMR interpretation
- **Live-run event flood**: aggregated events query groups by stage/eventType with counts instead of returning 28K+ individual rows

### WHONET Isolate Row → Canonical Record Mapping

```
WHONET Column          → Canonical Field
─────────────────────────────────────────────────
PATIENT_ID             → patient.patient_guid / folder_no
FIRST_NAME             → patient.firstname
LAST_NAME              → patient.surname
SEX                    → patient.sex
DATE_BIRTH             → patient.patient_data.date_of_birth
LABORATORY             → lab_request.facility_code (concept)
COUNTRY_A              → lab_request.facility_code.properties.country
SPEC_DATE              → lab_request.taken_datetime
SPEC_CODE              → lab_request.specimen_code (concept)
ORGANISM               → isolates[0].organism_code (concept)
AMP_ND10 (value)       → susceptibility_tests[].quantitative_value
AMP_ND10 (interpreted) → susceptibility_tests[].susceptibility_value (R/I/S)
CIP_NM (value)         → susceptibility_tests[].quantitative_value
CIP_NM (interpreted)   → susceptibility_tests[].susceptibility_value (R/I/S)
... (repeat for all antibiotic columns)
```

## AI Chat — GGUF Model Support (2026-04-01)

Refactored the AI service's model manager and Studio's model selector to support GGUF quantized models via `llama-cpp-python` instead of `transformers` + `torch` for model loading.

### Backend (apps/openldr-ai)

Fully replaced `transformers` + `torch` inference pipeline with `llama-cpp-python`. Models are identified by `(model_id, filename)` — e.g. `("LiquidAI/LFM2-2.6B-GGUF", "LFM2-2.6B-Q8_0.gguf")`. Download fetches a single GGUF file via `hf_hub_download`. Loading creates a `Llama(n_ctx=4096, n_gpu_layers=0)` instance. Inference uses `create_chat_completion(stream=True/False)` instead of `TextIteratorStreamer` + `model.generate()`.

| File                                                | Change                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/openldr-ai/src/services/model_manager.py`     | Replaced transformers/torch loading with llama-cpp-python; `filename` required for download, auto-discovered for load |
| `apps/openldr-ai/src/services/inference.py`         | Rewritten — uses `llm.create_chat_completion(stream=True)` instead of `TextIteratorStreamer`                          |
| `apps/openldr-ai/src/services/agentic_inference.py` | Rewritten — buffered first pass via `create_chat_completion(stream=False)`, streaming final answer via `stream=True`  |
| `apps/openldr-ai/src/models/schemas.py`             | Added `filename` field to `ModelDownloadRequest` and `LoadModelRequest`                                               |
| `apps/openldr-ai/src/routers/models.py`             | Passes `filename` through to download/load/status functions                                                           |
| `apps/openldr-ai/src/requirements.txt`              | Added `llama-cpp-python`                                                                                              |
| `apps/openldr-ai/Dockerfile`                        | BuildKit cache mounts for pip to avoid re-downloading packages                                                        |

### Frontend (apps/openldr-studio)

Updated model selector with GGUF-specific suggested models (LFM2-1.2B, LFM2-2.6B), each carrying a `filename` field. Added a second input for custom GGUF filename. Plumbed `filename` through store → API client → download progress → load button.

| File                                                                       | Change                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/openldr-studio/src/components/chat/chat-model-selector.tsx`          | GGUF model entries with filename, custom filename input, corrected 1.2B repo to `LFM2-1.2B-GGUF` |
| `apps/openldr-studio/src/components/chat/chat-model-download-progress.tsx` | Accepts `filename` prop, passes to `startDownload` and `loadModel`                               |
| `apps/openldr-studio/src/store/model-store.ts`                             | `startDownload` and `loadModel` accept optional `filename`                                       |
| `apps/openldr-studio/src/lib/restClients/aiRestClient.ts`                  | `downloadModel` and `loadModel` send optional `filename` in body                                 |

### Also in this commit

- Enabled Chat page route and sidebar nav item (previously commented out with `//TODO add later`)
- Enabled AI docker build/start scripts in `openldr-ai/package.json`

### Bugs Fixed (2026-04-01)

- **"No model loaded" after loading GGUF**: `inference.py` and `agentic_inference.py` checked for `tokenizer` which is `None` with llama-cpp — rewritten to only check for `model`
- **404 on 1.2B download**: `ModelDownloadRequest` schema silently dropped `filename`, falling back to hardcoded `DEFAULT_FILENAME` (2.6B file) for all models
- **Wrong 1.2B repo**: `LiquidAI/LFM2-1.2B-Tool` only publishes safetensors — switched to `LiquidAI/LFM2-1.2B-GGUF`

---

## Schema Plugin Consolidation (2026-04-03)

Consolidated 8 standalone schema plugins into 2 multi-format plugins. Each plugin auto-detects the input format and parses accordingly, following the same `detectFormat → parseMessage → convertRecord` pattern.

### default.schema.js (v1.3.0) — Canonical Format Plugin

Handles data already in or close to the OpenLDR canonical schema. Supports:

- **JSON** — parsed objects pass through existing path (unchanged behavior)
- **XML** — canonical element names (`<patient>`, `<lab_request>`, `<lab_results>/<result>`, `<isolates>/<isolate>`, `<susceptibility_tests>/<test>`)
- **CSV / TSV** — column names map to canonical fields, rows grouped by `request_id`; delimiter auto-detected (tabs vs commas)
- **JSONL** — one canonical JSON record per line

### hl7-fhir.schema.js (v2.0.0) — HL7/FHIR Plugin

Handles HL7 v2.x and FHIR messages. Supports:

- **HL7 v2.x** — pipe-delimited segments (MSH/PID/OBR/OBX); detected when string starts with `MSH|`
- **FHIR JSON** — Bundle or standalone DiagnosticReport; handles both parsed objects and unparsed JSON strings
- **FHIR XML** — Bundle with DiagnosticReport, Patient, Observation, Specimen resources

Both plugins handle Buffer-like objects (`{ type: "Buffer", data: [...] }`) that arrive when the VM sandbox serializes Node.js Buffers.

### Deleted Plugins

`binary.schema.js`, `csv.schema.js`, `fhir-json.schema.js`, `fhir-xml.schema.js`, `generic-xml.schema.js`, `hl7v2.schema.js`, `text-plain.schema.js` — all logic merged into the two plugins above.

### Key Files

| File                                                                  | Role                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/openldr-minio/default-plugins/schema/default.schema.js`         | Multi-format canonical schema plugin (JSON/XML/CSV/TSV/JSONL)                  |
| `apps/openldr-minio/default-plugins/schema/hl7-fhir.schema.js`        | Multi-format HL7/FHIR plugin (HL7v2/FHIR JSON/FHIR XML)                        |
| `apps/openldr-minio/default-plugins/schema/default.schema.example.*`  | Example inputs: `.json`, `.xml`, `.csv`, `.tsv`, `.jsonl`                      |
| `apps/openldr-minio/default-plugins/schema/hl7-fhir.schema.example.*` | Example inputs: `.json`, `.xml`, `.v2.example.txt`                             |
| `apps/openldr-internal-database/migrations/02-openldr_external.sql`   | Expanded `HL7_V2` → granular coding systems (HL7_ORG/ABX/SPEC/FAC/TEST/RESULT) |

### Bugs Fixed (2026-04-03)

- **FHIR JSON as unparsed string**: upstream handler passes JSON as raw string when S3 content-type is `binary/octet-stream`; added `fhir-json-string` detection path
- **Buffer serialization in VM sandbox**: messages arrive as `{ type: "Buffer", data: [byte...] }` instead of parsed objects; added `coerceToStringOrObject()` to convert byte arrays to UTF-8 strings
- **FHIR status too long for CHAR(1)**: FHIR `DiagnosticReport.status` is `"final"` but DB column is `CHAR(1)`; added `mapResultStatus()` (final→F, preliminary→P, etc.)
- **FHIR XML `<code>` name collision**: `<code>` is both a CodeableConcept wrapper and a self-closing value element inside `<coding>`; regex matched the wrong one, causing null panel_code and observation_code; fixed with `xmlGetCodeableConcept()` that only matches content tags

---

## AI Chat — assistant-ui Integration (2026-04-03)

Replaced hand-built chat UI components with [assistant-ui](https://github.com/assistant-ui/assistant-ui) — a production-grade React chat component library. The backend (FastAPI + llama-cpp-python + MCP tools) is **unchanged**; only the frontend chat layer was swapped.

### Why

Building chat UX from scratch (streaming, markdown, auto-scroll, message editing, tool call rendering) was consuming significant effort. assistant-ui provides all of this out of the box with a single `ChatModelAdapter` integration point.

### Architecture

- **Runtime**: `useLocalRuntime` with a custom `ChatModelAdapter` that calls the existing `/ai/chat/agent` SSE endpoint
- **State**: assistant-ui manages conversation state internally via `LocalRuntime` — the Zustand `chat-store` is replaced for message state (model-store remains unchanged)
- **UI**: assistant-ui's `Thread` component replaces `ChatConversationView`, `ChatMessage`, `MarkdownRenderer`, `AgentStatusIndicator`, and `GenerationError`
- **Sidebar**: Kept the existing `ChatSidebar` — wired to assistant-ui's thread list via `ExternalStoreRuntime` or kept as-is with Zustand

### Key Files

| File                                                  | Role                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/components/chat/chat-runtime-provider.tsx`       | New — `AssistantRuntimeProvider` + `ChatModelAdapter` wrapping SSE stream     |
| `src/components/chat/chat-main.tsx`                   | Rewritten — uses assistant-ui `Thread` component                              |
| `src/components/chat/chat-welcome-screen.tsx`         | Simplified — uses assistant-ui `Composer`                                     |
| `src/components/chat/chat-conversation-view.tsx`      | Removed — replaced by assistant-ui `Thread`                                   |
| `src/components/chat/chat-message.tsx`                | Removed — replaced by assistant-ui message primitives                         |
| `src/components/chat/chat-content-parser.ts`          | Removed — assistant-ui handles content parsing                                |
| `src/components/chat/markdown-renderer.tsx`           | Removed — assistant-ui includes markdown rendering                            |
| `src/components/chat/chat-agent-status-indicator.tsx` | Removed — tool status shown via assistant-ui tool call UI                     |
| `src/components/chat/chat-generation-error.tsx`       | Removed — assistant-ui handles error states                                   |
| `src/components/chat/chat-input-box.tsx`              | Simplified — model selector kept, input delegated to assistant-ui             |
| `src/store/chat-store.ts`                             | Simplified — thread list management only, message state moved to assistant-ui |
| `src/lib/restClients/aiRestClient.ts`                 | Unchanged — SSE streaming functions reused by adapter                         |

### Package

- `@assistant-ui/react` — main dependency (includes runtime, components, hooks)

---

## Extension — What Works

- File upload and SQLite parsing via sql.js
- AMR engine initialization (8 inline resource files)
- AMR interpretation with batched processing and progress UI
- GLASS analysis pipeline (via `runAllGlassAnalyses`)
- CSV export and SQLite database export
- Dark theme UI with 3 tabs (Data / Analysis / GLASS)

## Extension — Known Limitations

- Data source is upload-only — no `openldr.data.query()` integration yet
- GLASS analysis is synchronous — may freeze on very large datasets
- No configuration UI — guideline year, expert rules hardcoded via SampleConfig.json
- Report generation (Excel/Word/PDF) exists in lib but not wired to UI
- RIS analysis entry points not yet exposed in UI
- SaTScan — Node.js-only, stubbed with try/catch for browser

## Build

```bash
cd extensions/openldr-ext-whonet-tool
npm install
npm run build     # → dist/index.html (~9MB, ~1.2MB gzip)
npm run pack      # → dist/extension.zip (~1.2MB)
```

---

## Landing Page Redesign — Ministry-Facing Content (2026-04-08)

The current landing page (`apps/openldr-web`) is entirely developer/extension-focused. It does not explain what OpenLDR is, why v2 was created, or what value it provides to Ministries of Health. Redesigning to lead with the platform story (based on the APHL ministry-facing PDF), then briefly mention extensibility. License corrected from MIT to Apache 2.0.

### Tasks

- [ ] **Task 34: Assets & metadata** — Copy `docs/assets/img/OpenODRv2Logo.png` to `apps/openldr-web/public/`. Update `index.html`: title → "OpenLDR — Open Laboratory Data Repository", meta description → platform mission, favicon → OpenLDR logo.
- [ ] **Task 35: Navigation** — Replace Microscope icon with OpenLDR logo image. Add "by APHL" attribution. Change nav links to "Challenge", "Platform", "Architecture", "Get Started". Rename "Launch App" → "Launch Studio".
- [ ] **Task 36: Hero section** — Badge: "Open Source · Apache 2.0". Headline: ministry-facing (e.g. "A single, trusted view of laboratory data across your health system"). Stats: "6 Report Types" / "8+ Data Formats" / "3 Standards" / "Apache 2.0". Replace terminal code demo with conceptual SVG illustration (data flowing from facilities → central hub → dashboards/reports).
- [ ] **Task 37: The Challenge & Why V2** (dark section) — Part A: 3-4 pain point cards (scattered data, no complete picture, capacity tracking gaps, outbreak detection delays). Part B: V1 vs V2 comparison cards (V1: guidelines only, fragmented; V2: complete system, modular, platform-agnostic).
- [ ] **Task 38: What Ministries Gain** (light section) — 6 outcome cards: Single Trusted View, Standardized Reporting (WHO GLASS), Real-time Dashboards, Data Quality Assurance, International Standards (LOINC/SNOMED/ICD via OCL), Sovereignty & Control.
- [ ] **Task 39: Platform Capabilities** (light section) — Radix Accordion with 6 items: Data Ingestion (HL7/FHIR/XML/CSV/JSON/PDF), Processing Pipeline (validation→mapping→storage→outpost + Kafka), Terminology Management (OCL, coding systems), Reports & Analytics (6 report types), Dashboards (lab metrics + infrastructure), Forms & Data Entry (form builder + bulk import).
- [ ] **Task 40: Architecture diagram** (dark section) — SVG/React component: data sources → ingestion → validation → mapping → storage → outputs (dashboards/reports/APIs). Infrastructure badges: PostgreSQL, Kafka, Keycloak, MinIO, OpenSearch. Future readiness note: FHIR APIs, AI-assisted plugins, predictive analytics.
- [ ] **Task 41: Extensibility** (compact, light section) — Brief paragraph on plugin/extension support. Mention 4 plugin slot types + iframe/worker extensions. Link to docs/GitHub. No SDK reference, no extension showcase, no terminal demo.
- [ ] **Task 42: CTA + Footer** — CTA: two-track ("Contact APHL" for decision makers, "View on GitHub" for technical teams). Footer: OpenLDR logo + "An APHL initiative", Apache 2.0 license, nav links, APHL/GitHub links, copyright "© 2025 APHL".

### Key Files

| File | Change |
| --- | --- |
| `apps/openldr-web/src/App.tsx` | Complete content rewrite — all 9 sections |
| `apps/openldr-web/src/index.css` | Minor additions for new section styles |
| `apps/openldr-web/index.html` | Title, meta description, favicon |
| `apps/openldr-web/public/OpenODRv2Logo.png` | New — logo asset |

---

# Docker Hub Deployment — Handoff Tasks

## For Maintainers (Publishing Images)

- [ ] Create a Docker Hub organization (e.g., `openldr`) or decide on a shared account
- [ ] Grant Docker Hub push access to team members who will publish images
- [ ] Run `docker login` on the build machine
- [ ] Run the build-and-push script from the repo root:
  - Linux/macOS: `./docker/scripts/build-and-push.sh --registry <org> --tag <version>`
  - Windows: `.\docker\scripts\build-and-push.ps1 -Registry <org> -Tag <version>`
- [ ] Verify all 10 images are visible on Docker Hub (including `openldr-init`)
- [ ] Copy Kafka Connect JARs to `docker/config/kafka-connect/` (from `apps/openldr-kafka/kafka-connect/`)
- [ ] Replace self-signed SSL certs in `docker/certs/` with production certificates

## For Deployers (Running Services)

- [ ] Navigate to the `docker/` folder
- [ ] Copy `.env.example` to `.env` and update all `<change-me>` values
- [ ] Update `HOST_IP` and `DOCKER_HOST_IP` to match the server's IP or domain
- [ ] Update `KEYCLOAK_PUBLIC_URL`, `ENTITY_SERVICES_PUBLIC_URL`, `DATA_PROCESSING_PUBLIC_URL`, `MINIO_BROWSER_REDIRECT_URL` with the correct host
- [ ] Place SSL certificates in `docker/certs/` (or use the included self-signed certs for dev)
- [ ] Place Kafka Connect JARs in `docker/config/kafka-connect/`
- [ ] Run `docker compose up -d`
- [ ] Verify `openldr-init` completed successfully: `docker compose logs openldr-init`
- [ ] Verify all services are healthy: `docker compose ps`
- [ ] Access the application at `https://<HOST_IP>:443`

## Files Reference

| File | Purpose |
|------|---------|
| `docker/docker-compose.yml` | Unified compose with all containers + init |
| `apps/openldr-init/` | One-shot init container (Keycloak, Kafka, MinIO setup) |
| `docker/.env.example` | Environment variable template |
| `docker/scripts/build-and-push.sh` | Build & push script (Linux/macOS) |
| `docker/scripts/build-and-push.ps1` | Build & push script (Windows) |
| `docker/config/postgres/migrations/` | Database initialization SQL |
| `docker/config/keycloak/` | Keycloak realm import config |
| `docker/config/kafka-connect/` | Kafka Connect connector JARs (manual) |
| `docker/certs/` | SSL certificates |
| `docker/README.md` | Full deployment documentation |
