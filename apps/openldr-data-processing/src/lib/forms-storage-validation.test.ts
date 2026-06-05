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
