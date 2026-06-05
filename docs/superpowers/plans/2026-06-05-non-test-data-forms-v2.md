# Non-test (documentation) data — OpenLDR v2 forms subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "forms" (non-test/documentation) data-feed to OpenLDR v2 that ingests form-submission payloads (no specimen required) end-to-end through the existing schema → mapper → storage → outpost plugin chain into new `form_submissions` + `form_responses` tables in `openldr_external`.

**Architecture:** A new `Built-in-Forms` data-feed sits under the existing `Built-in` project + use-case in the control plane (`openldr.dataFeeds`), wired to four new plugins (`default.forms.{schema,mapper,storage,outpost}.js`) seeded into MinIO. The storage event handler is made envelope-aware: when the message body carries a `submission` block (forms payload) instead of `lab_request` (lab payload), it dispatches a forms-specific canonical validator and a forms persistence writer. New tables join the existing `patients`/`facilities`/`concepts`/`import_batches` schema; `related_request_id` nullable-references `lab_requests(id)` for split records emitted by the cdr-toolchain CLI.

**Tech Stack:** TypeScript (data-processing service), raw SQL migrations (no ORM), `node:test` runner, Kafka topics (`mapped-inbound` → `processed-inbound`), MinIO buckets (project-id-keyed), Postgres (`openldr` control plane + `openldr_external` data plane), `vm.Script`-sandboxed JS plugins.

**Scope:** This plan covers **System A only** (OpenLDR v2 forms subsystem). **System B (cdr-toolchain CLI)** is already implemented and shipped on `main` in the cdr-toolchain repo. The CLI POSTs the forms payload defined by the spec — this plan delivers v2's side of that contract.

**Contract reference:** Form-submission payload shape is frozen in the cdr-toolchain spec at `D:\Projects\Repositories\cdr-toolchain\docs\superpowers\specs\2026-06-05-non-test-data-forms-subsystem-design.md`. Faithfully implement that contract.

**Architecture context (already mapped):**
- HTTP handler: `apps/openldr-data-processing/src/controllers/data.processing.controller.ts` (POST `/api/v1/processor/process-feed` writes raw bytes to MinIO; Kafka triggers the plugin chain).
- Storage event handler: `apps/openldr-data-processing/src/events/handlers/storage.ts` (resolves dataFeed → loads `storagePluginId` JS from MinIO → executes via `vm.Script` → calls `external-persistence.service.ts` → writes processed MinIO object).
- Plugin registry: `apps/openldr-data-processing/src/services/plugin.service.ts` (`resolvePluginSelection({pluginID, pluginType})` reads `plugins` table → `pluginMinioObjectPath` → `runtime-plugin.service.ts` streams JS from MinIO `plugins` bucket).
- Lab persistence: `apps/openldr-data-processing/src/services/external-persistence.service.ts` (raw SQL via `externalPool` from `lib/db.external`).
- Lab plugins live at `apps/openldr-minio/default-plugins/{schema,mapper,storage,outpost}/default.{stage}.js`.
- Seed: `apps/openldr-minio/openldr.ts` (`seedDefaultPlugins()` + `seedBuiltinProject()`).
- Control-plane DDL: `apps/openldr-internal-database/migrations/01-openldr.sql` (projects, useCases, plugins, dataFeeds, formSchemas).
- External DDL: `apps/openldr-internal-database/migrations/02-openldr_external.sql` (patients, facilities, concepts, lab_requests, lab_results, import_batches).
- Docker DB copy: `docker/config/postgres/migrations/0{1,2}-*.sql` — every external DDL change MUST be mirrored.
- Test runner: `node:test` (e.g. `apps/openldr-data-processing/src/lib/db.plugin.test.ts`).

---

## File Structure

**Create:**
- `apps/openldr-internal-database/migrations/03-form_submissions.sql` — new `form_submissions` + `form_responses` tables in `openldr_external`.
- `docker/config/postgres/migrations/03-form_submissions.sql` — Docker copy (identical bytes).
- `apps/openldr-data-processing/src/lib/forms-storage-validation.ts` — canonical envelope validator for forms.
- `apps/openldr-data-processing/src/lib/forms-storage-validation.test.ts`
- `apps/openldr-data-processing/src/services/forms-persistence.service.ts` — `persistFormSubmissionToExternal()` writer (form_submissions + form_responses + optional related_request_id resolution).
- `apps/openldr-data-processing/src/services/forms-persistence.service.test.ts`
- `apps/openldr-minio/default-plugins/schema/default.forms.schema.js` — forms schema plugin (`validate`, `convert`).
- `apps/openldr-minio/default-plugins/mapper/default.forms.mapper.js` — forms mapper plugin (`map`).
- `apps/openldr-minio/default-plugins/storage/default.forms.storage.js` — forms storage plugin (`process`).
- `apps/openldr-minio/default-plugins/outpost/default.forms.outpost.js` — forms outpost plugin (`process`).

**Modify:**
- `apps/openldr-data-processing/src/events/handlers/storage.ts` — make `validateCanonicalStorageRequirements` envelope-aware (dispatch lab vs forms); dispatch persistence by envelope.
- `apps/openldr-minio/openldr.ts` — `seedDefaultPlugins()` adds the 4 forms plugins with fixed UUIDs; `seedBuiltinProject()` adds the `Built-in-Forms` dataFeed.

**Fixed UUIDs (reserve now to keep migrations and seeds deterministic):**
- `Built-in-Forms` dataFeed id: `00000000-0000-0000-0001-000000000005`
- Forms schema plugin id: `1a000001-0000-4000-8000-000000000001`
- Forms mapper plugin id: `1a000001-0000-4000-8000-000000000002`
- Forms storage plugin id: `1a000001-0000-4000-8000-000000000003`
- Forms outpost plugin id: `1a000001-0000-4000-8000-000000000004`

---

## Task 1: Worktree + baseline (one-time setup)

**Goal:** isolated worktree, deps installed, baseline tests + Docker stack runnable.

- [ ] **Step 1: Create an isolated worktree** (use the platform's `EnterWorktree` tool if available, else `git worktree add .worktrees/forms-v2 -b worktree-forms-v2`). Verify ignored: `git check-ignore .worktrees` — add to `.gitignore` + commit if not.

- [ ] **Step 2: Install + baseline**

```bash
pnpm install
pnpm -C apps/openldr-data-processing test
```
Expected: install completes; existing tests pass (note count — must remain ≥ that on every later task).

- [ ] **Step 3: Confirm dev DB + MinIO are reachable**

```bash
docker ps --format '{{.Names}}' | grep -E "postgres|minio|kafka"
```
Expected: postgres, minio, kafka containers running. If they aren't: `docker compose -f docker/docker-compose.yml up -d postgres minio kafka` (adapt to the actual compose file in `docker/`).

No commit on this task — pure setup.

---

## Task 2: SQL migration — `form_submissions` + `form_responses`

**Files:**
- Create: `apps/openldr-internal-database/migrations/03-form_submissions.sql`
- Create: `docker/config/postgres/migrations/03-form_submissions.sql` (identical copy)

- [ ] **Step 1: Author the migration**

Create `apps/openldr-internal-database/migrations/03-form_submissions.sql`:
```sql
-- ============================================================================
-- form_submissions + form_responses — non-test "documentation" data
-- Parallel to lab_requests + lab_results but with NO specimen requirement.
-- Receives data from the "Built-in-Forms" data-feed via the forms plugin
-- chain. CLI emits these for documentation observations (e.g. Zambia VIRAL,
-- Tanzania VLID/EIDID) so they migrate as first-class records instead of
-- quarantining for the missing specimen.
-- ============================================================================

CREATE TABLE form_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL REFERENCES patients(id),
    facility_id         UUID NOT NULL REFERENCES facilities(id),
    source_system       VARCHAR(100),
    external_ref        VARCHAR(255) NOT NULL,            -- origin id (e.g. DISA lab number)
    submitted_at        TIMESTAMPTZ,
    related_request_id  UUID REFERENCES lab_requests(id), -- nullable; set on split records when lab leg is resolvable
    related_request_ref VARCHAR(255),                     -- raw external ref to lab leg (kept even if FK unresolved)
    form_code           VARCHAR(100),                     -- logical form code (e.g. hiv_vl_documentation)
    form_schema_id      UUID,                             -- optional; FK declared after formSchemas reachable
    submission_data     JSONB DEFAULT '{}',               -- full original payload for provenance
    import_batch_id     UUID REFERENCES import_batches(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (external_ref, facility_id, form_code)
);

CREATE INDEX idx_form_submissions_patient        ON form_submissions(patient_id);
CREATE INDEX idx_form_submissions_facility       ON form_submissions(facility_id);
CREATE INDEX idx_form_submissions_external_ref   ON form_submissions(external_ref);
CREATE INDEX idx_form_submissions_form_code      ON form_submissions(form_code);
CREATE INDEX idx_form_submissions_submitted_at   ON form_submissions(submitted_at);
CREATE INDEX idx_form_submissions_related_req    ON form_submissions(related_request_id)
    WHERE related_request_id IS NOT NULL;
CREATE INDEX idx_form_submissions_data_gin       ON form_submissions USING gin(submission_data);

CREATE TRIGGER set_form_submissions_updated_at
    BEFORE UPDATE ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE form_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    concept_id      UUID REFERENCES concepts(id),                     -- resolved concept (nullable if unresolved)
    concept_code    VARCHAR(100),                                     -- raw code (e.g. ARTRS)
    concept_system  VARCHAR(50),                                      -- e.g. DEFAULT_RESULT
    value_type      VARCHAR(20) NOT NULL CHECK (value_type IN ('numeric','text','coded')),
    numeric_value   NUMERIC,
    text_value      TEXT,
    coded_value     VARCHAR(255),
    ordinal         INTEGER,
    raw_value       JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_form_responses_submission ON form_responses(submission_id);
CREATE INDEX idx_form_responses_concept    ON form_responses(concept_id)    WHERE concept_id IS NOT NULL;
CREATE INDEX idx_form_responses_code       ON form_responses(concept_code);
```

- [ ] **Step 2: Copy verbatim to docker migrations**

```bash
cp apps/openldr-internal-database/migrations/03-form_submissions.sql \
   docker/config/postgres/migrations/03-form_submissions.sql
```

- [ ] **Step 3: Apply to the running dev DB**

```bash
docker exec -i $(docker ps --format '{{.Names}}' | grep postgres | head -1) \
  psql -U postgres -d openldr_external < apps/openldr-internal-database/migrations/03-form_submissions.sql
```
Expected: `CREATE TABLE` x2, `CREATE INDEX` x9, `CREATE TRIGGER` x1, no errors.

- [ ] **Step 4: Verify the schema**

```bash
docker exec $(docker ps --format '{{.Names}}' | grep postgres | head -1) \
  psql -U postgres -d openldr_external -c "\d form_submissions" \
  -c "\d form_responses"
```
Expected: both tables present with the FKs and indexes above.

- [ ] **Step 5: Commit**

```bash
git add apps/openldr-internal-database/migrations/03-form_submissions.sql \
        docker/config/postgres/migrations/03-form_submissions.sql
git commit -m "feat(db): add form_submissions and form_responses tables to openldr_external"
```

---

## Task 3: Forms storage canonical validator

**Files:**
- Create: `apps/openldr-data-processing/src/lib/forms-storage-validation.ts`
- Test: `apps/openldr-data-processing/src/lib/forms-storage-validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/openldr-data-processing/src/lib/forms-storage-validation.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCanonicalFormsRequirements, isFormsEnvelope } from "./forms-storage-validation.js";

test("isFormsEnvelope true when submission block is present", () => {
  assert.equal(isFormsEnvelope({ submission: { external_ref: "X" } }), true);
});

test("isFormsEnvelope false for lab envelopes (no submission block)", () => {
  assert.equal(isFormsEnvelope({ patient: {}, lab_request: {} }), false);
});

test("accepts a valid forms message", () => {
  const msg = {
    submission: {
      external_ref: "ZUL0800028",
      patient: { patient_guid: "ZUL0800028" },
      facility_concept_id: "fac-uuid",
      responses: [{ concept_id: "c-uuid", value_type: "text", text_value: "Routine" }],
    },
  };
  assert.doesNotThrow(() => validateCanonicalFormsRequirements(msg));
});

test("rejects missing patient_guid", () => {
  const msg = {
    submission: {
      external_ref: "X",
      patient: {},
      facility_concept_id: "f",
      responses: [{ concept_id: "c", value_type: "text", text_value: "v" }],
    },
  };
  assert.throws(() => validateCanonicalFormsRequirements(msg), /patient_guid/);
});

test("rejects missing facility_concept_id (mapper must have resolved it)", () => {
  const msg = {
    submission: {
      external_ref: "X",
      patient: { patient_guid: "X" },
      responses: [{ concept_id: "c", value_type: "text", text_value: "v" }],
    },
  };
  assert.throws(() => validateCanonicalFormsRequirements(msg), /facility_concept_id/);
});

test("rejects response with unknown value_type", () => {
  const msg = {
    submission: {
      external_ref: "X",
      patient: { patient_guid: "X" },
      facility_concept_id: "f",
      responses: [{ value_type: "bogus" }],
    },
  };
  assert.throws(() => validateCanonicalFormsRequirements(msg), /value_type/);
});

test("rejects empty responses array (a submission must carry at least one response)", () => {
  const msg = {
    submission: {
      external_ref: "X",
      patient: { patient_guid: "X" },
      facility_concept_id: "f",
      responses: [],
    },
  };
  assert.throws(() => validateCanonicalFormsRequirements(msg), /at least one response/);
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm -C apps/openldr-data-processing exec node --import tsx --test \
  "src/lib/forms-storage-validation.test.ts"
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/openldr-data-processing/src/lib/forms-storage-validation.ts`:
```ts
import { createStageError } from "./pipeline-error.js";

/** True when the storage-stage message envelope is a form submission rather
 *  than a lab request. The mapper writes the submission block under the same
 *  top-level key the schema validated. */
export function isFormsEnvelope(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    "submission" in message &&
    typeof (message as { submission: unknown }).submission === "object"
  );
}

/** Canonical storage validation for a forms message. Mirrors the lab
 *  validator's role: assert the mapper produced everything storage needs.
 *  Specifically does NOT require specimen_concept_id (forms have no
 *  specimen by definition). */
export function validateCanonicalFormsRequirements(message: any): void {
  const errors: string[] = [];
  const sub = message?.submission;

  if (!sub || typeof sub !== "object") {
    errors.push("submission block is required");
  } else {
    if (!sub.external_ref || typeof sub.external_ref !== "string") {
      errors.push("submission.external_ref is required");
    }
    if (!sub.patient?.patient_guid) {
      errors.push("submission.patient.patient_guid is required");
    }
    if (!sub.facility_concept_id) {
      errors.push("submission.facility_concept_id is required");
    }

    const responses = sub.responses;
    if (!Array.isArray(responses) || responses.length === 0) {
      errors.push("submission.responses must carry at least one response");
    } else {
      responses.forEach((r: any, i: number) => {
        if (!r || typeof r !== "object") {
          errors.push(`submission.responses[${i}] must be an object`);
          return;
        }
        if (!["numeric", "text", "coded"].includes(r.value_type)) {
          errors.push(`submission.responses[${i}].value_type must be numeric|text|coded`);
        }
      });
    }
  }

  if (errors.length > 0) {
    throw createStageError({
      stage: "storage",
      code: "CANONICAL_FORMS_STORAGE_VALIDATION_FAILED",
      message: "Forms storage validation failed",
      details: { errors },
      retryable: false,
    });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm -C apps/openldr-data-processing exec node --import tsx --test \
  "src/lib/forms-storage-validation.test.ts"
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/openldr-data-processing/src/lib/forms-storage-validation.ts \
        apps/openldr-data-processing/src/lib/forms-storage-validation.test.ts
git commit -m "feat(data-processing): canonical storage validator for forms envelope"
```

---

## Task 4: Forms persistence service

**Files:**
- Create: `apps/openldr-data-processing/src/services/forms-persistence.service.ts`
- Test: `apps/openldr-data-processing/src/services/forms-persistence.service.test.ts`

This writes a form submission + its responses to `openldr_external`, mirroring how `external-persistence.service.ts` writes lab data. Reuses the same `externalPool` and follows the same upsert-by-natural-key pattern.

- [ ] **Step 1: Read the lab persistence pattern**

Read `apps/openldr-data-processing/src/services/external-persistence.service.ts` end-to-end before implementing. Mirror its idioms (pg pool usage, helper functions like `normalizeNullableString`, `toIsoTimestamp`, transactional patterns, `_metadata`/`_resolved_concepts` extraction). Do NOT touch that file; copy the pattern.

- [ ] **Step 2: Write the failing test**

Create `apps/openldr-data-processing/src/services/forms-persistence.service.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { persistFormSubmissionToExternal } from "./forms-persistence.service.js";
import { externalPool } from "../lib/db.external.js";

// Integration-style tests against the local openldr_external DB.
// Requires the dev postgres + the form_submissions / form_responses tables
// (created by 03-form_submissions.sql).

async function ensurePatientAndFacility() {
  const patientId = "11111111-1111-1111-1111-111111111111";
  const facilityId = "22222222-2222-2222-2222-222222222222";
  await externalPool.query(
    `INSERT INTO patients (id, patient_guid) VALUES ($1, 'TEST-PAT')
     ON CONFLICT (id) DO NOTHING`, [patientId]);
  await externalPool.query(
    `INSERT INTO facilities (id, facility_concept_id, name)
     VALUES ($1, NULL, 'Test Facility') ON CONFLICT (id) DO NOTHING`, [facilityId]);
  return { patientId, facilityId };
}

test("persistFormSubmissionToExternal writes submission + responses", async () => {
  const { patientId, facilityId } = await ensurePatientAndFacility();
  const externalRef = `TEST-${Date.now()}`;
  const result = await persistFormSubmissionToExternal({
    message: {
      submission: {
        external_ref: externalRef,
        source_system: "disa",
        form_code: "hiv_vl_documentation",
        submitted_at: "2019-01-25T09:49:00",
        patient: { patient_guid: "TEST-PAT" },
        facility_concept_id: facilityId,
        responses: [
          { concept_id: null, concept_code: "ARTRS", concept_system: "DEFAULT_RESULT",
            value_type: "text", text_value: "Routine", ordinal: 1, raw_value: { v: 1 } },
          { concept_id: null, concept_code: "ARTNO", concept_system: "DEFAULT_RESULT",
            value_type: "numeric", numeric_value: 504, ordinal: 2, raw_value: { v: 2 } },
        ],
      },
      _metadata: { facility: { facility_id: facilityId } },
      _resolved_patient_id: patientId,
    },
    dataFeed: { dataFeedId: "00000000-0000-0000-0001-000000000005" } as any,
    messageMetadata: { FileName: "test.json" } as any,
    kafkaKey: "key",
    processedBody: "{}",
  });

  assert.ok(result?.recordIds?.submissionId, "should return submissionId");
  const { rows: subs } = await externalPool.query(
    "SELECT external_ref, form_code FROM form_submissions WHERE id = $1",
    [result.recordIds.submissionId],
  );
  assert.equal(subs.length, 1);
  assert.equal(subs[0].external_ref, externalRef);
  assert.equal(subs[0].form_code, "hiv_vl_documentation");

  const { rows: resps } = await externalPool.query(
    "SELECT value_type, concept_code, ordinal FROM form_responses WHERE submission_id = $1 ORDER BY ordinal",
    [result.recordIds.submissionId],
  );
  assert.equal(resps.length, 2);
  assert.equal(resps[0].value_type, "text");
  assert.equal(resps[1].value_type, "numeric");
});

test("persistFormSubmissionToExternal is idempotent on (external_ref, facility, form_code)", async () => {
  const { patientId, facilityId } = await ensurePatientAndFacility();
  const externalRef = `IDEM-${Date.now()}`;
  const arg = {
    message: {
      submission: {
        external_ref: externalRef, source_system: "disa", form_code: "hiv_vl_documentation",
        patient: { patient_guid: "TEST-PAT" }, facility_concept_id: facilityId,
        responses: [
          { concept_code: "ARTRS", concept_system: "DEFAULT_RESULT",
            value_type: "text", text_value: "x", ordinal: 1, raw_value: {} },
        ],
      },
      _metadata: { facility: { facility_id: facilityId } },
      _resolved_patient_id: patientId,
    },
    dataFeed: { dataFeedId: "00000000-0000-0000-0001-000000000005" } as any,
    messageMetadata: { FileName: "test.json" } as any,
    kafkaKey: "key", processedBody: "{}",
  };
  const a = await persistFormSubmissionToExternal(arg);
  const b = await persistFormSubmissionToExternal(arg);
  assert.equal(a.recordIds.submissionId, b.recordIds.submissionId,
    "same submission id returned on duplicate ingest");
  const { rows } = await externalPool.query(
    "SELECT COUNT(*)::int AS n FROM form_responses WHERE submission_id = $1",
    [a.recordIds.submissionId],
  );
  assert.equal(rows[0].n, 1, "responses NOT duplicated on re-ingest");
});

test("related_request_id resolves when lab_requests row exists with the ref", async () => {
  const { patientId, facilityId } = await ensurePatientAndFacility();
  const externalRef = `LINK-${Date.now()}`;
  const labReqId = "33333333-3333-3333-3333-333333333333";
  await externalPool.query(
    `INSERT INTO lab_requests (id, patient_id, facility_id, request_id)
     VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [labReqId, patientId, facilityId, externalRef]);
  const result = await persistFormSubmissionToExternal({
    message: {
      submission: {
        external_ref: externalRef, related_request_id: externalRef,
        source_system: "disa", form_code: "hiv_vl_documentation",
        patient: { patient_guid: "TEST-PAT" }, facility_concept_id: facilityId,
        responses: [{ concept_code: "X", concept_system: "S",
          value_type: "text", text_value: "v", ordinal: 1, raw_value: {} }],
      },
      _metadata: { facility: { facility_id: facilityId } },
      _resolved_patient_id: patientId,
    },
    dataFeed: { dataFeedId: "00000000-0000-0000-0001-000000000005" } as any,
    messageMetadata: { FileName: "test.json" } as any,
    kafkaKey: "key", processedBody: "{}",
  });
  const { rows } = await externalPool.query(
    "SELECT related_request_id, related_request_ref FROM form_submissions WHERE id = $1",
    [result.recordIds.submissionId],
  );
  assert.equal(rows[0].related_request_id, labReqId);
  assert.equal(rows[0].related_request_ref, externalRef);
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
pnpm -C apps/openldr-data-processing exec node --import tsx --test \
  "src/services/forms-persistence.service.test.ts"
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `apps/openldr-data-processing/src/services/forms-persistence.service.ts`:
```ts
import { externalPool } from "../lib/db.external.js";

export interface PersistFormsArgs {
  message: any;
  dataFeed: any;
  messageMetadata: any;
  kafkaKey: string;
  processedBody: string;
}

export interface PersistFormsResult {
  recordIds: { submissionId: string };
}

function nz(v: any): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function toIsoTimestamp(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function jsonOrEmpty(v: any): string {
  return JSON.stringify(v ?? {});
}

/** Upserts the form_submissions row + its responses inside one transaction.
 *  Idempotent via UNIQUE (external_ref, facility_id, form_code): on re-ingest
 *  the existing submission_id is returned and responses are not duplicated.
 *  Resolves related_request_id by looking up lab_requests.request_id matching
 *  submission.related_request_id at the same facility; leaves it null when
 *  no match (the raw ref is always stored in related_request_ref). */
export async function persistFormSubmissionToExternal(
  args: PersistFormsArgs,
): Promise<PersistFormsResult> {
  const sub = args.message?.submission ?? {};
  const facilityId =
    args.message?._metadata?.facility?.facility_id ??
    args.message?._resolved_facility_id ??
    sub.facility_concept_id; // mapper-resolved facility UUID
  const patientId =
    args.message?._resolved_patient_id ??
    args.message?._metadata?.patient?.patient_id;

  if (!facilityId) throw new Error("forms persistence: missing facility_id after mapper");
  if (!patientId) throw new Error("forms persistence: missing patient_id after mapper");

  const externalRef = String(sub.external_ref);
  const formCode = nz(sub.form_code);
  const submittedAt = toIsoTimestamp(sub.submitted_at);
  const sourceSystem = nz(sub.source_system);

  const client = await externalPool.connect();
  try {
    await client.query("BEGIN");

    let relatedRequestId: string | null = null;
    const relatedRef = nz(sub.related_request_id);
    if (relatedRef) {
      const r = await client.query<{ id: string }>(
        `SELECT id FROM lab_requests
         WHERE request_id = $1 AND facility_id = $2
         LIMIT 1`,
        [relatedRef, facilityId],
      );
      relatedRequestId = r.rows[0]?.id ?? null;
    }

    const upsert = await client.query<{ id: string; inserted: boolean }>(
      `INSERT INTO form_submissions
         (patient_id, facility_id, source_system, external_ref, submitted_at,
          related_request_id, related_request_ref, form_code, submission_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (external_ref, facility_id, form_code) DO UPDATE
         SET submitted_at       = EXCLUDED.submitted_at,
             source_system      = EXCLUDED.source_system,
             related_request_id = COALESCE(form_submissions.related_request_id, EXCLUDED.related_request_id),
             related_request_ref= COALESCE(form_submissions.related_request_ref, EXCLUDED.related_request_ref),
             submission_data    = EXCLUDED.submission_data,
             updated_at         = NOW()
       RETURNING id, (xmax = 0) AS inserted`,
      [
        patientId, facilityId, sourceSystem, externalRef, submittedAt,
        relatedRequestId, relatedRef, formCode, jsonOrEmpty(sub),
      ],
    );
    const submissionId = upsert.rows[0].id;
    const inserted = upsert.rows[0].inserted;

    // On re-ingest don't duplicate responses — replace the set transactionally
    // so partial reruns converge to the current payload.
    if (!inserted) {
      await client.query(`DELETE FROM form_responses WHERE submission_id = $1`, [submissionId]);
    }

    const responses = Array.isArray(sub.responses) ? sub.responses : [];
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      const ordinal = typeof r.ordinal === "number" ? r.ordinal : i + 1;
      const valueType = String(r.value_type);
      if (!["numeric", "text", "coded"].includes(valueType)) {
        throw new Error(`forms persistence: invalid value_type at responses[${i}]: ${valueType}`);
      }
      await client.query(
        `INSERT INTO form_responses
           (submission_id, concept_id, concept_code, concept_system,
            value_type, numeric_value, text_value, coded_value,
            ordinal, raw_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [
          submissionId,
          r.concept_id ?? null,
          nz(r.concept_code),
          nz(r.concept_system),
          valueType,
          valueType === "numeric" && r.numeric_value != null ? Number(r.numeric_value) : null,
          valueType === "text" ? (r.text_value ?? null) : null,
          valueType === "coded" ? nz(r.coded_value) : null,
          ordinal,
          jsonOrEmpty(r.raw_value),
        ],
      );
    }

    await client.query("COMMIT");
    return { recordIds: { submissionId } };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
pnpm -C apps/openldr-data-processing exec node --import tsx --test \
  "src/services/forms-persistence.service.test.ts"
```
Expected: PASS (3 tests). If `patients`/`facilities` columns differ from `(id, patient_guid)` / `(id, facility_concept_id, name)` in the running DB, adjust the test fixture's `ensurePatientAndFacility()` ONLY (do not change the persistence service) to insert valid rows.

- [ ] **Step 6: Commit**

```bash
git add apps/openldr-data-processing/src/services/forms-persistence.service.ts \
        apps/openldr-data-processing/src/services/forms-persistence.service.test.ts
git commit -m "feat(data-processing): forms persistence writer with idempotent upsert + related-request linkage"
```

---

## Task 5: Make the storage event handler envelope-aware

**Files:**
- Modify: `apps/openldr-data-processing/src/events/handlers/storage.ts`

The current handler:
1. Calls `validateCanonicalStorageRequirements(messageContent)` — lab-only.
2. Calls `externalPersistenceService.persistProcessedMessageToExternal(...)`.

We branch BOTH on the envelope. Lab path is unchanged; forms path uses the new validator + persistence service.

- [ ] **Step 1: Add the imports**

In `apps/openldr-data-processing/src/events/handlers/storage.ts`, add to the import block:
```ts
import { isFormsEnvelope, validateCanonicalFormsRequirements } from "../../lib/forms-storage-validation.js";
import * as formsPersistenceService from "../../services/forms-persistence.service.js";
```

- [ ] **Step 2: Dispatch validation by envelope**

Replace the line `validateCanonicalStorageRequirements(messageContent);` with:
```ts
if (isFormsEnvelope(messageContent)) {
  validateCanonicalFormsRequirements(messageContent);
} else {
  validateCanonicalStorageRequirements(messageContent);
}
```

- [ ] **Step 3: Dispatch persistence by envelope**

Replace the `persistenceResult = await externalPersistenceService.persistProcessedMessageToExternal({...})` call with:
```ts
persistenceResult = isFormsEnvelope(processedMessage)
  ? await formsPersistenceService.persistFormSubmissionToExternal({
      message: processedMessage,
      dataFeed,
      messageMetadata,
      kafkaKey: key,
      processedBody: bodyData,
    })
  : await externalPersistenceService.persistProcessedMessageToExternal({
      message: processedMessage,
      dataFeed,
      messageMetadata,
      kafkaKey: key,
      processedBody: bodyData,
    });
```

- [ ] **Step 4: Verify build + existing tests**

```bash
pnpm -C apps/openldr-data-processing build
pnpm -C apps/openldr-data-processing test
```
Expected: build succeeds; existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/openldr-data-processing/src/events/handlers/storage.ts
git commit -m "feat(data-processing): storage handler dispatches forms vs lab validators + persistence by envelope"
```

---

## Task 6: Forms schema plugin

**Files:**
- Create: `apps/openldr-minio/default-plugins/schema/default.forms.schema.js`

Plugins are CommonJS JS modules executed in `vm.Script`. Required exports for the schema stage: `validate(payload)` returning `{ valid, reason, details }` and `convert(payload)` returning the validated/normalized payload. Read the lab counterpart (`apps/openldr-minio/default-plugins/schema/default.schema.js`) for the exact module conventions (how it exports, what fields it puts in the result).

- [ ] **Step 1: Read the lab schema plugin**

`apps/openldr-minio/default-plugins/schema/default.schema.js` — confirm whether it uses `module.exports = { validate, convert }` or globals; confirm the shape of `{ valid, reason, details }`.

- [ ] **Step 2: Author the forms schema plugin**

Create `apps/openldr-minio/default-plugins/schema/default.forms.schema.js` (CommonJS, must match the export convention you observed in step 1 — pattern below shows `module.exports`):
```js
"use strict";

// Form-submission envelope schema. Schemaless-first: form_id/form_code is
// optional; required is the patient + facility code + at least one response
// with a value_type. Concept resolution is best-effort and happens in the
// mapper.

function fail(reason, details) {
  return { valid: false, reason: reason, details: details || {} };
}

function ok() {
  return { valid: true };
}

function validate(payload) {
  if (!payload || typeof payload !== "object") return fail("payload-not-object");
  var sub = payload.submission;
  if (!sub || typeof sub !== "object") return fail("submission-missing");

  if (!sub.external_ref || typeof sub.external_ref !== "string") {
    return fail("external_ref-required", { got: typeof sub.external_ref });
  }
  if (!sub.patient || typeof sub.patient !== "object") {
    return fail("patient-missing");
  }
  if (!sub.patient.patient_guid || typeof sub.patient.patient_guid !== "string") {
    return fail("patient_guid-required");
  }
  if (!sub.facility_code || typeof sub.facility_code !== "object") {
    return fail("facility_code-missing");
  }
  if (!sub.facility_code.concept_code || typeof sub.facility_code.concept_code !== "string") {
    return fail("facility_code.concept_code-required");
  }
  if (!Array.isArray(sub.responses) || sub.responses.length === 0) {
    return fail("responses-required", { expected: "non-empty array" });
  }
  for (var i = 0; i < sub.responses.length; i++) {
    var r = sub.responses[i];
    if (!r || typeof r !== "object") return fail("response-not-object", { index: i });
    if (["numeric", "text", "coded"].indexOf(r.value_type) === -1) {
      return fail("value_type-invalid", { index: i, got: r.value_type });
    }
    if (!r.concept_code || typeof r.concept_code !== "object" ||
        typeof r.concept_code.concept_code !== "string") {
      return fail("response.concept_code-required", { index: i });
    }
  }
  return ok();
}

function convert(payload) {
  // Schemaless: pass through unchanged. Normalize one thing — guarantee
  // each response has an ordinal so downstream code doesn't have to recompute.
  var sub = payload.submission;
  var responses = sub.responses.map(function (r, i) {
    return Object.assign({}, r, { ordinal: typeof r.ordinal === "number" ? r.ordinal : i + 1 });
  });
  return Object.assign({}, payload, { submission: Object.assign({}, sub, { responses: responses }) });
}

module.exports = { validate: validate, convert: convert };
```

- [ ] **Step 3: Commit**

```bash
git add apps/openldr-minio/default-plugins/schema/default.forms.schema.js
git commit -m "feat(plugins): forms schema plugin (validate + convert) for submission envelopes"
```

(Verification happens end-to-end in Task 11; the plugin runner has its own tests for the lab plugin path which we are not changing here.)

---

## Task 7: Forms mapper plugin

**Files:**
- Create: `apps/openldr-minio/default-plugins/mapper/default.forms.mapper.js`

The mapper resolves concept codes into concept_ids and patient/facility UUIDs. For forms, we resolve:
- `submission.patient.patient_guid` → upsert into `patients` → put resolved `patient_id` on the envelope.
- `submission.facility_code` → resolve to facility UUID → put on `submission.facility_concept_id`.
- Each `response.concept_code` → resolve (best-effort) → set `response.concept_id`; on miss, leave null + populate `response.concept_code` / `response.concept_system` strings (the persistence service already stores both).

- [ ] **Step 1: Read the lab mapper plugin**

`apps/openldr-minio/default-plugins/mapper/default.mapper.js` — see how it does concept resolution (DB pool? message-passing back to the runtime?). The runtime injects helpers; document what's available before authoring.

- [ ] **Step 2: Author the forms mapper plugin (template — adapt API calls to the host pattern you found in step 1)**

Create `apps/openldr-minio/default-plugins/mapper/default.forms.mapper.js`:
```js
"use strict";

// Forms mapper: resolves patient_guid -> patient_id (upserted), facility code
// -> facility_id, and each response.concept_code -> concept_id (best-effort).
//
// IMPORTANT — host API: the lab default.mapper.js uses host-provided helpers
// (db pool / lookup functions) injected via the vm context. Mirror its exact
// import / global pattern; the snippets below assume the same `host` object.

async function map(payload, host) {
  var sub = payload.submission;

  // Patient: upsert by patient_guid, get UUID
  var patientId = await host.upsertPatient({
    patient_guid: sub.patient.patient_guid,
    firstname: sub.patient.firstname || null,
    middlename: sub.patient.middlename || null,
    surname: sub.patient.surname || null,
    sex: sub.patient.sex || null,
    date_of_birth: sub.patient.date_of_birth || null,
    folder_no: sub.patient.folder_no || null,
    phone: sub.patient.phone || null,
    email: sub.patient.email || null,
    national_id: sub.patient.national_id || null,
    patient_data: sub.patient.patient_data || {},
  });

  // Facility: resolve by (system_id, concept_code) to facilityId
  var facilityId = await host.resolveFacility({
    system_id: sub.facility_code.system_id,
    concept_code: sub.facility_code.concept_code,
    display_name: sub.facility_code.display_name,
    properties: sub.facility_code.properties || null,
  });

  // Responses: best-effort concept resolution
  var responses = [];
  for (var i = 0; i < sub.responses.length; i++) {
    var r = sub.responses[i];
    var cc = r.concept_code || {};
    var resolved = await host.resolveConcept({
      system_id: cc.system_id,
      concept_code: cc.concept_code,
      display_name: cc.display_name,
      concept_class: cc.concept_class,
      datatype: cc.datatype,
    });
    responses.push(Object.assign({}, r, {
      concept_id: resolved && resolved.concept_id ? resolved.concept_id : null,
      concept_code: cc.concept_code,
      concept_system: cc.system_id,
    }));
  }

  return Object.assign({}, payload, {
    submission: Object.assign({}, sub, {
      facility_concept_id: facilityId,
      responses: responses,
    }),
    _resolved_patient_id: patientId,
    _resolved_facility_id: facilityId,
  });
}

module.exports = { map: map };
```

> If the lab mapper exposes the resolver under a different global / function name (e.g. `mapping` instead of `map`, or no `host` arg), match THAT convention exactly. The runtime accepts both `map` and `mapping` per the architecture brief; pick whichever the lab counterpart uses.

- [ ] **Step 3: Commit**

```bash
git add apps/openldr-minio/default-plugins/mapper/default.forms.mapper.js
git commit -m "feat(plugins): forms mapper plugin — resolves patient/facility/concept codes"
```

---

## Task 8: Forms storage plugin

**Files:**
- Create: `apps/openldr-minio/default-plugins/storage/default.forms.storage.js`

The storage plugin returns a result the handler embeds as `_processing_results`. Persistence to `openldr_external` is done by the handler via `formsPersistenceService.persistFormSubmissionToExternal` (Task 4). So the plugin's `process` mostly normalizes / returns a summary.

- [ ] **Step 1: Read the lab storage plugin**

`apps/openldr-minio/default-plugins/storage/default.storage.js` — confirm what it returns from `process(payload)` (probably `{ records: { ... }, notes: [...] }` or similar). Match that shape.

- [ ] **Step 2: Author the forms storage plugin**

Create `apps/openldr-minio/default-plugins/storage/default.forms.storage.js`:
```js
"use strict";

// Forms storage plugin. The actual DB writes happen in the data-processing
// service (forms-persistence.service.ts); this plugin just summarises the
// payload for traceability and ratifies that the envelope is what we expect.

function process(payload) {
  var sub = payload && payload.submission;
  if (!sub) {
    throw new Error("forms storage plugin: missing submission");
  }
  var responses = Array.isArray(sub.responses) ? sub.responses : [];
  return {
    summary: {
      external_ref: sub.external_ref,
      form_code: sub.form_code || null,
      responses: responses.length,
      patient_resolved: !!payload._resolved_patient_id,
      facility_resolved: !!payload._resolved_facility_id,
    },
    notes: ["forms-storage v1.0.0"],
  };
}

module.exports = { process: process };
```

- [ ] **Step 3: Commit**

```bash
git add apps/openldr-minio/default-plugins/storage/default.forms.storage.js
git commit -m "feat(plugins): forms storage plugin (process returns summary; persistence done by handler)"
```

---

## Task 9: Forms outpost plugin

**Files:**
- Create: `apps/openldr-minio/default-plugins/outpost/default.forms.outpost.js`

The outpost is a downstream notifier. For forms MVP, a passthrough is sufficient (the spec marks outpost as "existing downstream behaviour, forms-aware" — meaning we don't add new external destinations yet).

- [ ] **Step 1: Read the lab outpost plugin**

`apps/openldr-minio/default-plugins/outpost/default.outpost.js` — see the shape of `process(payload)` it returns.

- [ ] **Step 2: Author the forms outpost plugin**

Create `apps/openldr-minio/default-plugins/outpost/default.forms.outpost.js`:
```js
"use strict";

// Forms outpost plugin — passthrough for MVP. Returns a small summary so the
// stage tracker has something to log; emits no external dispatch.

function process(payload) {
  var sub = payload && payload.submission;
  return {
    delivered_to: [],
    summary: {
      external_ref: sub && sub.external_ref || null,
      form_code: sub && sub.form_code || null,
    },
    notes: ["forms-outpost v1.0.0 (passthrough)"],
  };
}

module.exports = { process: process };
```

- [ ] **Step 3: Commit**

```bash
git add apps/openldr-minio/default-plugins/outpost/default.forms.outpost.js
git commit -m "feat(plugins): forms outpost plugin (passthrough)"
```

---

## Task 10: Seed `Built-in-Forms` dataFeed + 4 forms plugins

**Files:**
- Modify: `apps/openldr-minio/openldr.ts`

The seed inserts plugin rows + a dataFeed row using fixed UUIDs (idempotent via `ON CONFLICT`). Mirror the existing `seedDefaultPlugins()` / `seedBuiltinProject()` structure for the lab feed.

- [ ] **Step 1: Read the existing seed**

Read `apps/openldr-minio/openldr.ts` end-to-end before editing. Note:
- The exact SQL the lab seed uses (column casing — quoted identifiers like `"dataFeedId"`).
- How plugin MinIO objects are uploaded (uploading the JS file to bucket `plugins` under the path stored in `pluginMinioObjectPath`).
- The MinIO path scheme: confirm whether it is `<pluginId>/<filename>.js` (architecture brief implies this) and reuse.

- [ ] **Step 2: Add a `seedFormsPlugins()` and call it from `seedDefaultPlugins()`**

In `apps/openldr-minio/openldr.ts`, locate `seedDefaultPlugins()`. Add a `seedFormsPlugins()` that:
1. Uploads the four new JS files (from Tasks 6–9) to MinIO at paths `1a000001-0000-4000-8000-000000000001/default.forms.schema.js`, `…02/default.forms.mapper.js`, `…03/default.forms.storage.js`, `…04/default.forms.outpost.js`.
2. Inserts plugin rows with those fixed UUIDs into `plugins` (same pattern as the lab seed), using `pluginType`s `schema`, `mapper`, `storage`, `outpost`, `pluginVersion '1.0.0'`, `securityLevel 'low'` (matching lab defaults), `isBundled true`, `ON CONFLICT ("pluginId") DO UPDATE SET ...`.

Call `seedFormsPlugins()` from inside `seedDefaultPlugins()` AFTER the existing lab plugin seed.

(Use the existing lab plugin seed as the literal template — copy the SQL and adjust UUIDs / file paths / pluginType for each of the four entries.)

- [ ] **Step 3: Add the `Built-in-Forms` dataFeed to `seedBuiltinProject()`**

In `seedBuiltinProject()`, after the existing `Built-in` dataFeed insert, add a parallel insert for `Built-in-Forms` using the same `useCaseId` as the lab feed:
```ts
await client.query(
  `INSERT INTO "dataFeeds"
     ("dataFeedId", "dataFeedName",
      "schemaPluginId", "mapperPluginId", "storagePluginId", "outpostPluginId",
      "useCaseId", "isEnabled", "isProtected")
   VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
   ON CONFLICT ("dataFeedId") DO UPDATE SET
     "dataFeedName"    = EXCLUDED."dataFeedName",
     "schemaPluginId"  = EXCLUDED."schemaPluginId",
     "mapperPluginId"  = EXCLUDED."mapperPluginId",
     "storagePluginId" = EXCLUDED."storagePluginId",
     "outpostPluginId" = EXCLUDED."outpostPluginId",
     "useCaseId"       = EXCLUDED."useCaseId",
     "updatedAt"       = NOW()`,
  [
    "00000000-0000-0000-0001-000000000005",
    "Built-in-Forms",
    "1a000001-0000-4000-8000-000000000001",
    "1a000001-0000-4000-8000-000000000002",
    "1a000001-0000-4000-8000-000000000003",
    "1a000001-0000-4000-8000-000000000004",
    BUILTIN_USE_CASE_ID, // reuse the constant already defined for the lab feed
  ],
);
```
> Replace `BUILTIN_USE_CASE_ID` with whatever the existing seed names this constant. If it's an inline literal, use it inline.

- [ ] **Step 4: Re-run the seed**

```bash
pnpm -C apps/openldr-minio start  # or whatever command runs the seeder
```
Expected: seed completes without error, idempotently.

- [ ] **Step 5: Verify**

```bash
docker exec $(docker ps --format '{{.Names}}' | grep postgres | head -1) \
  psql -U postgres -d openldr -c \
  "SELECT \"dataFeedId\", \"dataFeedName\" FROM \"dataFeeds\" WHERE \"dataFeedName\" = 'Built-in-Forms'"
docker exec $(docker ps --format '{{.Names}}' | grep postgres | head -1) \
  psql -U postgres -d openldr -c \
  "SELECT \"pluginId\", \"pluginName\", \"pluginType\" FROM plugins WHERE \"pluginId\" LIKE '1a000001%' ORDER BY \"pluginType\""
```
Expected: 1 `Built-in-Forms` row with the four forms plugin UUIDs assigned; 4 plugin rows of types schema/mapper/storage/outpost.

And in MinIO, list the new objects:
```bash
docker exec $(docker ps --format '{{.Names}}' | grep minio | head -1) \
  mc ls myminio/plugins | grep -E "1a000001"
```
Expected: four entries.

- [ ] **Step 6: Commit**

```bash
git add apps/openldr-minio/openldr.ts
git commit -m "feat(seed): Built-in-Forms dataFeed + 4 forms plugins in openldr-minio"
```

---

## Task 11: End-to-end smoke

**Goal:** POST a real forms payload to the running stack and confirm rows appear in `form_submissions` / `form_responses`.

- [ ] **Step 1: Mint a token + resolve the forms feed id**

```bash
TOKEN=$(curl -sk -X POST \
  "https://127.0.0.1:443/keycloak/realms/openldr-realm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=openldr-client&client_secret=$KC_SECRET" \
  | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).access_token)")

curl -sk -H "Authorization: Bearer $TOKEN" \
  "https://127.0.0.1/data-processing/api/v1/projects/use-cases/00000000-0000-0000-0001-000000000002/feeds" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).feeds.find(f=>f.dataFeedName==='Built-in-Forms')))"
```
Expected: feed found, `dataFeedId` = `00000000-0000-0000-0001-000000000005`.

- [ ] **Step 2: POST a documentation submission**

```bash
FEED=00000000-0000-0000-0001-000000000005
curl -sk -X POST "https://127.0.0.1/data-processing/api/v1/processor/process-feed" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-DataFeed-Id: $FEED" \
  -d '{
    "submission": {
      "external_ref": "SMOKE-001",
      "source_system": "disa",
      "form_code": "hiv_vl_documentation",
      "submitted_at": "2019-01-25T09:49:00",
      "patient": { "patient_guid": "SMOKE-001", "sex": "F" },
      "facility_code": { "system_id": "DEFAULT_FAC", "concept_code": "MATUC",
                         "display_name": "Matero Main Urban Clinic",
                         "concept_class": "facility", "datatype": "coded" },
      "responses": [
        { "concept_code": { "system_id": "DEFAULT_RESULT", "concept_code": "ARTRS",
                            "display_name": "Viral load reason",
                            "concept_class": "test", "datatype": "coded" },
          "value_type": "text", "text_value": "Routine Monitoring",
          "ordinal": 1, "raw_value": { "disa_type_code": 5 } }
      ]
    }
  }'
```
Expected: HTTP 200 with a `messageId` in the body.

- [ ] **Step 3: Wait for async processing then verify**

```bash
sleep 4
docker exec $(docker ps --format '{{.Names}}' | grep postgres | head -1) \
  psql -U postgres -d openldr_external -c \
  "SELECT id, external_ref, form_code FROM form_submissions WHERE external_ref = 'SMOKE-001'"
docker exec $(docker ps --format '{{.Names}}' | grep postgres | head -1) \
  psql -U postgres -d openldr_external -c \
  "SELECT concept_code, value_type, text_value FROM form_responses
   WHERE submission_id = (SELECT id FROM form_submissions WHERE external_ref = 'SMOKE-001')"
```
Expected: 1 submission row + 1 response row matching the POSTed payload.

- [ ] **Step 4: Re-POST to verify idempotency**

Repeat Step 2 verbatim, then re-run Step 3 queries. Expected: still exactly 1 submission + 1 response (no duplicates).

- [ ] **Step 5: Commit any fixups discovered**

If the smoke surfaced minor wiring fixes (env var name, log line, etc.), commit them. If the smoke surfaced a real defect, STOP and fix the failing task before continuing.

```bash
git add -A && git commit -m "test: end-to-end forms-feed smoke" || true
```

---

## Task 12: Finishing the branch

- [ ] **Step 1: Final verification**

```bash
pnpm -C apps/openldr-data-processing test
pnpm -C apps/openldr-data-processing build
```
Expected: all tests pass; build clean.

- [ ] **Step 2: Use the finishing-a-development-branch skill**

Invoke `superpowers:finishing-a-development-branch` to pick how to integrate (merge locally / open PR / keep / discard). Recommended: open a PR (System A is server-side and benefits from review by anyone who runs the data-processing stack).

---

## Self-Review

**Spec coverage:**
- New `form_submissions` table → Task 2 ✓
- New `form_responses` table → Task 2 ✓
- Optional `form_definitions` / `form_fields` → DEFERRED per spec's "schemaless-first" decision ✓
- New forms data-feed (`Built-in-Forms`) + own `X-DataFeed-Id` → Task 10 ✓
- Schema plugin (best-effort concept resolution, unresolved concepts accepted) → Tasks 6 + 7 ✓
- Mapper plugin (resolves system_id/concept_code → concept_id; patient/facility) → Task 7 ✓
- Storage plugin (no specimen required) → Tasks 5, 8 ✓
- Outpost plugin (existing downstream behaviour, forms-aware) → Task 9 (passthrough MVP) ✓
- API contract — form-submission payload shape → Tasks 3, 6, 11 ✓
- Cross-DB boundary (control plane vs external) → enforced by Tasks 2 (external) and 10 (control plane) ✓
- Split-record `related_request_id` linkage → Task 4 ✓

**Placeholder scan:** None. Tasks 6, 7, 8, 9 explicitly tell the implementer to "read the lab counterpart first and match the convention you find" — these are verification instructions, not placeholders; the contract (what the new plugin must do) is concrete.

**Type consistency:** `submission.external_ref` / `submission.responses[].value_type` / `_resolved_patient_id` / `_resolved_facility_id` / `recordIds.submissionId` are used consistently across the validator (Task 3), persistence service (Task 4), handler dispatch (Task 5), and the plugins (Tasks 6–9). Fixed UUIDs are stated once and reused. The `Built-in-Forms` `dataFeedName` matches the CLI's `OPENLDR_FORMS_DATA_FEED_NAME=Built-in-Forms`.

**Known gaps acknowledged:**
- The plugin task steps depend on reading the corresponding lab plugin to match the host-API convention (CommonJS export vs globals, helper function names). This deliberately doesn't prescribe a convention the plan may have guessed wrong on — the implementer matches what they find.
- Task 4's persistence service test inserts seed `patients` + `facilities` rows; if the actual column shape differs from `(id, patient_guid)` / `(id, facility_concept_id, name)`, adjust the test fixture, NOT the persistence service.
- Outpost is a passthrough — wiring real outpost destinations for forms is out of scope for MVP.
