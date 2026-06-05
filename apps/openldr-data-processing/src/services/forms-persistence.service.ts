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

// ---------------------------------------------------------------------------
// Helpers — aligned with external-persistence.service.ts conventions
// ---------------------------------------------------------------------------

function normalizeNullableString(value: any): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function normalizeCode(value: any, maxLength = 3): string | null {
  const text = normalizeNullableString(value);
  if (!text) return null;
  const normalized = text.toUpperCase();
  return normalized.length <= maxLength ? normalized : null;
}

function toIsoTimestamp(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function asJson(value: any): string {
  return JSON.stringify(value ?? {});
}

// ---------------------------------------------------------------------------
// Facility upsert — mirrors upsertFacility in external-persistence.service.ts
// but reads from the FORMS submission envelope instead of the lab envelope.
//
// Resolution priority:
//   1. submission._resolved_concepts entry with source_field === "facility_code"
//   2. _metadata.facility.facility_code / .facility_name
// ---------------------------------------------------------------------------

async function upsertFormsFacility(
  client: any,
  message: any,
): Promise<{ id: string }> {
  // 1. Look for a resolved concept (written by the terminology service)
  const resolvedFacility = (
    message?.submission?._resolved_concepts ?? []
  ).find((r: any) => r.source_field === "facility_code");

  // 2. Raw facility_code block on submission (concept-ref shape from mapper)
  const rawFacilityBlock = message?.submission?.facility_code ?? {};

  const facilityCode =
    normalizeNullableString(resolvedFacility?.concept_code) ||
    normalizeNullableString(rawFacilityBlock?.concept_code) ||
    normalizeNullableString(message?._metadata?.facility?.facility_code);

  const facilityName =
    normalizeNullableString(resolvedFacility?.display_name) ||
    normalizeNullableString(rawFacilityBlock?.display_name) ||
    normalizeNullableString(message?._metadata?.facility?.facility_name) ||
    facilityCode;

  if (!facilityCode || !facilityName) {
    throw new Error(
      "forms persistence: cannot upsert facility — no facility_code resolved from submission",
    );
  }

  const facilityConceptId =
    normalizeNullableString(message?.submission?.facility_concept_id) ?? null;

  const countryCode  = normalizeCode(message?._metadata?.facility?.country_code,  3);
  const provinceCode = normalizeCode(message?._metadata?.facility?.province_code, 3);
  const cityCode     = normalizeCode(message?._metadata?.facility?.district_code,  3);

  const metadata = {
    source_data_feed_id:     message?._metadata?.data_feed_id ?? null,
    source_metadata_facility: message?._metadata?.facility ?? null,
    concept: facilityConceptId ? { facility_concept_id: facilityConceptId } : null,
  };

  const sql = `
    INSERT INTO facilities (
      facility_code,
      facility_name,
      facility_type,
      country_code,
      region,
      district,
      province,
      city,
      address,
      metadata,
      facility_concept_id,
      updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,NOW()
    )
    ON CONFLICT (facility_code)
    DO UPDATE SET
      facility_name        = EXCLUDED.facility_name,
      facility_type        = COALESCE(EXCLUDED.facility_type,        facilities.facility_type),
      country_code         = COALESCE(EXCLUDED.country_code,         facilities.country_code),
      region               = COALESCE(EXCLUDED.region,               facilities.region),
      district             = COALESCE(EXCLUDED.district,             facilities.district),
      province             = COALESCE(EXCLUDED.province,             facilities.province),
      city                 = COALESCE(EXCLUDED.city,                 facilities.city),
      address              = COALESCE(EXCLUDED.address,              facilities.address),
      facility_concept_id  = COALESCE(EXCLUDED.facility_concept_id,  facilities.facility_concept_id),
      metadata             = COALESCE(facilities.metadata, '{}'::jsonb) || EXCLUDED.metadata,
      updated_at           = NOW()
    RETURNING id;
  `;

  const result = await client.query(sql, [
    facilityCode,
    facilityName,
    null,                                  // facility_type — not in forms submission
    normalizeNullableString(countryCode),
    null,                                  // region
    null,                                  // district
    normalizeNullableString(provinceCode),
    normalizeNullableString(cityCode),
    null,                                  // address
    asJson(metadata),
    facilityConceptId,
  ]);

  return result.rows[0] as { id: string };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upserts a form_submissions row and its form_responses inside one
 * transaction.  Idempotent via UNIQUE (external_ref, facility_id, form_code):
 * on re-ingest the existing submission_id is returned and the response set is
 * atomically replaced (DELETE + INSERT) so re-runs always converge to the
 * current payload without duplicating rows.
 *
 * related_request_id is resolved by looking up lab_requests.request_id at the
 * same facility matching submission.related_request_id.  When no row is found
 * the FK is left NULL but the raw ref is always stored in related_request_ref.
 *
 * Patient is upserted inline (same pattern as persistProcessedMessageToExternal)
 * because the mapper plugin runs in a sandboxed VM with no DB access.
 * Facility is upserted inline via upsertFormsFacility (reads submission.facility_code
 * concept-ref or _metadata.facility fallback) — dataFeed has no facilityId column.
 */
export async function persistFormSubmissionToExternal(
  args: PersistFormsArgs,
): Promise<PersistFormsResult> {
  const sub = args.message?.submission ?? {};

  const externalRef   = String(sub.external_ref);
  const formCode      = normalizeNullableString(sub.form_code);
  const submittedAt   = toIsoTimestamp(sub.submitted_at);
  const sourceSystem  = normalizeNullableString(sub.source_system);

  const client = await externalPool.connect();
  try {
    await client.query("BEGIN");

    // ------------------------------------------------------------------
    // 0a. Upsert facility — same pattern as upsertFacility in
    //     external-persistence.service.ts.  dataFeed has NO facilityId
    //     column, so we derive the id from the submission's facility_code.
    // ------------------------------------------------------------------
    const facilityRow = await upsertFormsFacility(client, args.message);
    const facilityId  = facilityRow.id;

    // ------------------------------------------------------------------
    // 0b. Upsert patient — mirrors persistProcessedMessageToExternal so the
    //     mapper plugin (a sandboxed VM) never needs DB access.
    // ------------------------------------------------------------------
    const patientGuid = normalizeNullableString(sub.patient?.patient_guid);
    if (!patientGuid) {
      throw new Error("forms persistence: missing submission.patient.patient_guid");
    }
    const patientUpsert = await client.query<{ id: string }>(
      `INSERT INTO patients
         (patient_guid, facility_id, surname, firstname, date_of_birth,
          sex, national_id, patient_data, source_system, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NOW())
       ON CONFLICT (patient_guid, facility_id) DO UPDATE
         SET surname      = COALESCE(EXCLUDED.surname,     patients.surname),
             firstname    = COALESCE(EXCLUDED.firstname,   patients.firstname),
             date_of_birth= COALESCE(EXCLUDED.date_of_birth, patients.date_of_birth),
             sex          = COALESCE(EXCLUDED.sex,         patients.sex),
             national_id  = COALESCE(EXCLUDED.national_id, patients.national_id),
             patient_data = COALESCE(patients.patient_data, '{}'::jsonb) || EXCLUDED.patient_data,
             source_system= EXCLUDED.source_system,
             updated_at   = NOW()
       RETURNING id`,
      [
        patientGuid,
        facilityId,
        normalizeNullableString(sub.patient?.surname),
        normalizeNullableString(sub.patient?.firstname),
        toIsoTimestamp(sub.patient?.date_of_birth) ?? null,
        normalizeNullableString(sub.patient?.sex),
        normalizeNullableString(sub.patient?.national_id),
        JSON.stringify(sub.patient ?? {}),
        normalizeNullableString(sub.source_system),
      ],
    );
    const patientId = patientUpsert.rows[0].id;

    // ------------------------------------------------------------------
    // 1. Resolve related_request_id (optional FK to lab_requests)
    // ------------------------------------------------------------------
    let relatedRequestId: string | null = null;
    const relatedRef = normalizeNullableString(sub.related_request_id);
    if (relatedRef) {
      const r = await client.query<{ id: string }>(
        `SELECT id FROM lab_requests
         WHERE request_id = $1 AND facility_id = $2
         LIMIT 1`,
        [relatedRef, facilityId],
      );
      relatedRequestId = r.rows[0]?.id ?? null;
    }

    // ------------------------------------------------------------------
    // 2. Upsert form_submissions
    // ------------------------------------------------------------------
    const upsert = await client.query<{ id: string; inserted: boolean }>(
      `INSERT INTO form_submissions
         (patient_id, facility_id, source_system, external_ref, submitted_at,
          related_request_id, related_request_ref, form_code, submission_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (external_ref, facility_id, form_code) DO UPDATE
         SET submitted_at        = EXCLUDED.submitted_at,
             source_system       = EXCLUDED.source_system,
             related_request_id  = COALESCE(form_submissions.related_request_id, EXCLUDED.related_request_id),
             related_request_ref = COALESCE(form_submissions.related_request_ref, EXCLUDED.related_request_ref),
             submission_data     = EXCLUDED.submission_data,
             updated_at          = NOW()
       RETURNING id, (xmax = 0) AS inserted`,
      [
        patientId,
        facilityId,
        sourceSystem,
        externalRef,
        submittedAt,
        relatedRequestId,
        relatedRef,
        formCode,
        asJson(sub),
      ],
    );

    const submissionId = upsert.rows[0].id;
    const inserted     = upsert.rows[0].inserted;

    // ------------------------------------------------------------------
    // 3. Manage form_responses
    //    On re-ingest: atomically replace the prior response set so
    //    partial reruns converge to the current payload.
    // ------------------------------------------------------------------
    if (!inserted) {
      await client.query(
        "DELETE FROM form_responses WHERE submission_id = $1",
        [submissionId],
      );
    }

    const responses = Array.isArray(sub.responses) ? sub.responses : [];
    for (let i = 0; i < responses.length; i++) {
      const r       = responses[i];
      const ordinal = typeof r.ordinal === "number" ? r.ordinal : i + 1;
      const valueType = String(r.value_type);
      if (!["numeric", "text", "coded"].includes(valueType)) {
        throw new Error(
          `forms persistence: invalid value_type at responses[${i}]: ${valueType}`,
        );
      }

      // Normalize concept reference across the three shapes that reach here:
      //   1. Production (post-resolver): the terminology service walked the
      //      response's `concept_code` ref, wrote `concept_concept_id`, STRIPPED
      //      the original `concept_code` field, and pushed a record into
      //      `r._resolved_concepts` with { source_field, concept_id, system_id,
      //      concept_code, display_name, ... }.
      //   2. Pre-resolver object (defensive — mapper passed it through raw).
      //   3. Unit tests: flat strings on r.concept_code / r.concept_system.
      const conceptRes = Array.isArray(r._resolved_concepts)
        ? r._resolved_concepts.find((e: any) => e?.source_field === "concept_code")
        : null;
      let conceptCodeStr: string | null = null;
      let conceptSystemStr: string | null = null;
      let conceptId: string | null = null;
      if (conceptRes) {
        conceptCodeStr   = normalizeNullableString(conceptRes.concept_code);
        conceptSystemStr = normalizeNullableString(conceptRes.system_id);
        conceptId        = conceptRes.concept_id ?? null;
      } else if (r.concept_code && typeof r.concept_code === "object") {
        conceptCodeStr   = normalizeNullableString(r.concept_code.concept_code);
        conceptSystemStr = normalizeNullableString(r.concept_code.system_id);
        conceptId        = r.concept_concept_id ?? r.concept_id ?? null;
      } else {
        conceptCodeStr   = normalizeNullableString(r.concept_code);
        conceptSystemStr = normalizeNullableString(r.concept_system);
        conceptId        = r.concept_id ?? null;
      }

      await client.query(
        `INSERT INTO form_responses
           (submission_id, concept_id, concept_code, concept_system,
            value_type, numeric_value, text_value, coded_value,
            ordinal, raw_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [
          submissionId,
          conceptId,
          conceptCodeStr,
          conceptSystemStr,
          valueType,
          valueType === "numeric" && r.numeric_value != null ? Number(r.numeric_value) : null,
          valueType === "text"    ? (r.text_value ?? null)                              : null,
          valueType === "coded"   ? normalizeNullableString(r.coded_value)              : null,
          ordinal,
          asJson(r.raw_value),
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
