import { test } from "node:test";
import assert from "node:assert/strict";
import { persistFormSubmissionToExternal } from "./forms-persistence.service.js";
import { externalPool } from "../lib/db.external.js";

// Integration tests against the local openldr_external DB.
// Requires the dev openldr-postgres container + the form_submissions /
// form_responses tables (created by 03-form_submissions.sql).
//
// Seed UUIDs are fixed so runs are idempotent (ON CONFLICT DO NOTHING).
// patients.UNIQUE is (patient_guid, facility_id).
// facilities.UNIQUE is (facility_code).
// lab_requests.UNIQUE is (request_id, obr_set_id, facility_id).

const FACILITY_ID          = "22222222-2222-2222-2222-222222222222";
const PATIENT_ID           = "11111111-1111-1111-1111-111111111111";
const LAB_REQ_ID           = "33333333-3333-3333-3333-333333333333";
const LAB_REQ_REQUEST_ID   = "TEST-LAB-REQ-001";

async function ensurePatientAndFacility() {
  // facilities NOT NULL: facility_code, facility_name
  await externalPool.query(
    `INSERT INTO facilities (id, facility_code, facility_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (facility_code) DO NOTHING`,
    [FACILITY_ID, "TEST-FAC-001", "Test Facility"],
  );

  // patients NOT NULL: patient_guid, facility_id
  await externalPool.query(
    `INSERT INTO patients (id, patient_guid, facility_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (patient_guid, facility_id) DO NOTHING`,
    [PATIENT_ID, "TEST-PAT-GUID-001", FACILITY_ID],
  );

  return { patientId: PATIENT_ID, facilityId: FACILITY_ID };
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
        patient: { patient_guid: "TEST-PAT-GUID-001" },
        facility_code: {
          system_id: "DEFAULT_FAC", concept_code: "TEST-FAC-001",
          display_name: "Test Facility",
          concept_class: "facility", datatype: "coded",
        },
        responses: [
          {
            concept_id: null, concept_code: "ARTRS", concept_system: "DEFAULT_RESULT",
            value_type: "text", text_value: "Routine", ordinal: 1, raw_value: { v: 1 },
          },
          {
            concept_id: null, concept_code: "ARTNO", concept_system: "DEFAULT_RESULT",
            value_type: "numeric", numeric_value: 504, ordinal: 2, raw_value: { v: 2 },
          },
        ],
      },
      _metadata: { facility: { facility_code: "TEST-FAC-001", facility_name: "Test Facility" } },
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

test("persistFormSubmissionToExternal is idempotent on (external_ref, facility_id, form_code)", async () => {
  const { patientId, facilityId } = await ensurePatientAndFacility();
  const externalRef = `IDEM-${Date.now()}`;
  const arg = {
    message: {
      submission: {
        external_ref: externalRef,
        source_system: "disa",
        form_code: "hiv_vl_documentation",
        patient: { patient_guid: "TEST-PAT-GUID-001" },
        facility_code: {
          system_id: "DEFAULT_FAC", concept_code: "TEST-FAC-001",
          display_name: "Test Facility",
          concept_class: "facility", datatype: "coded",
        },
        responses: [
          {
            concept_code: "ARTRS", concept_system: "DEFAULT_RESULT",
            value_type: "text", text_value: "x", ordinal: 1, raw_value: {},
          },
        ],
      },
      _metadata: { facility: { facility_code: "TEST-FAC-001", facility_name: "Test Facility" } },
      _resolved_patient_id: patientId,
    },
    dataFeed: { dataFeedId: "00000000-0000-0000-0001-000000000005" } as any,
    messageMetadata: { FileName: "test.json" } as any,
    kafkaKey: "key",
    processedBody: "{}",
  };

  const a = await persistFormSubmissionToExternal(arg);
  const b = await persistFormSubmissionToExternal(arg);
  assert.equal(
    a.recordIds.submissionId,
    b.recordIds.submissionId,
    "same submission id returned on duplicate ingest",
  );

  const { rows } = await externalPool.query(
    "SELECT COUNT(*)::int AS n FROM form_responses WHERE submission_id = $1",
    [a.recordIds.submissionId],
  );
  assert.equal(rows[0].n, 1, "responses NOT duplicated on re-ingest");
});

test("related_request_id resolves when lab_requests row exists with the ref", async () => {
  const { patientId, facilityId } = await ensurePatientAndFacility();
  // fresh external_ref each run so form_submissions never conflicts with prior runs
  const externalRef = `LINK-${Date.now()}`;

  // lab_requests NOT NULL: patient_id, facility_id, request_id
  // UNIQUE (request_id, obr_set_id, facility_id) is unreliable as a conflict
  // target here because obr_set_id is NULL and PG treats NULLs as distinct.
  // Upsert by PK so the fixture converges to the correct request_id on every
  // run regardless of prior state.
  await externalPool.query(
    `INSERT INTO lab_requests (id, patient_id, facility_id, request_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET patient_id  = EXCLUDED.patient_id,
           facility_id = EXCLUDED.facility_id,
           request_id  = EXCLUDED.request_id`,
    [LAB_REQ_ID, patientId, facilityId, LAB_REQ_REQUEST_ID],
  );

  const result = await persistFormSubmissionToExternal({
    message: {
      submission: {
        external_ref: externalRef,
        related_request_id: LAB_REQ_REQUEST_ID,
        source_system: "disa",
        form_code: "hiv_vl_documentation",
        patient: { patient_guid: "TEST-PAT-GUID-001" },
        facility_code: {
          system_id: "DEFAULT_FAC", concept_code: "TEST-FAC-001",
          display_name: "Test Facility",
          concept_class: "facility", datatype: "coded",
        },
        responses: [
          {
            concept_code: "X", concept_system: "S",
            value_type: "text", text_value: "v", ordinal: 1, raw_value: {},
          },
        ],
      },
      _metadata: { facility: { facility_code: "TEST-FAC-001", facility_name: "Test Facility" } },
      _resolved_patient_id: patientId,
    },
    dataFeed: { dataFeedId: "00000000-0000-0000-0001-000000000005" } as any,
    messageMetadata: { FileName: "test.json" } as any,
    kafkaKey: "key",
    processedBody: "{}",
  });

  const { rows } = await externalPool.query(
    "SELECT related_request_id, related_request_ref FROM form_submissions WHERE id = $1",
    [result.recordIds.submissionId],
  );
  assert.equal(rows[0].related_request_id, LAB_REQ_ID);
  assert.equal(rows[0].related_request_ref, LAB_REQ_REQUEST_ID);
});

test.after(async () => {
  await externalPool.end();
});
