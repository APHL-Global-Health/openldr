import { createStageError } from "./pipeline-error";

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
