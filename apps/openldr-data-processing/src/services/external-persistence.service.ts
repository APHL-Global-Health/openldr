import crypto from "crypto";
import { externalPool } from "../lib/db.external";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asJson(value: any) {
  return JSON.stringify(value ?? {});
}

function normalizeNullableString(value: any) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeCode(value: any, maxLength = 3) {
  const text = normalizeNullableString(value);
  if (!text) return null;
  const normalized = text.toUpperCase();
  return normalized.length <= maxLength ? normalized : null;
}

function toIsoTimestamp(value: any) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toIsoDate(value: any) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function deriveSourceType(message: any) {
  const declared = normalizeNullableString(message?._plugin?.source_system);
  if (declared) return declared.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  return "api";
}

function deriveResultType(result: any) {
  const type = Number(
    result?.result_type ??
      result?.raw_result?.ResultType ??
      result?.raw_result?.Type,
  );
  if (type === 4) return "CE";
  if (type === 5) return "ST";
  if (type === 9) return "ST";

  const value = normalizeNullableString(
    result?.result_value ?? result?.raw_result?.Value,
  );
  if (!value) return "ST";
  if (/^[A-Z0-9_\-\.<>/=]+$/.test(value) && value.length <= 32) return "CE";
  return "ST";
}

function buildValueColumns(result: any) {
  const rawValue = normalizeNullableString(
    result?.result_value ??
      result?.susceptibility_value ??
      result?.raw_result?.Value,
  );
  const resultType: any =
    typeof result?.result_type === "string" && /^(CE|NM|ST)$/.test(result.result_type)
      ? result.result_type
      : deriveResultType(result);

  // Use explicit fields from the schema when provided
  let codedValue: string | null = normalizeNullableString(result?.coded_value) ?? null;
  let textValue: string | null = null;
  let numericValue: number | null =
    result?.numeric_value != null && !Number.isNaN(Number(result.numeric_value))
      ? Number(result.numeric_value)
      : null;

  // Fall back to deriving from rawValue when explicit fields aren't set
  if (codedValue == null && numericValue == null) {
    if (resultType === "CE") codedValue = rawValue;
    else if (resultType === "NM" && rawValue && !Number.isNaN(Number(rawValue)))
      numericValue = Number(rawValue);
    else textValue = rawValue;
  } else if (resultType === "ST" || (resultType !== "CE" && resultType !== "NM")) {
    textValue = rawValue;
  }

  return {
    resultType,
    codedValue,
    textValue,
    numericValue,
    rptResult: rawValue,
  };
}

function getResolvedConceptEntry(container: any, targetField: string) {
  const list = Array.isArray(container?._resolved_concepts)
    ? container._resolved_concepts
    : [];
  return list.find((item: any) => item?.target_field === targetField) || null;
}

function summarizeRecords(message: any) {
  return {
    total:
      (Array.isArray(message?.lab_results) ? message.lab_results.length : 0) +
      (Array.isArray(message?.isolates) ? message.isolates.length : 0) +
      (Array.isArray(message?.susceptibility_tests)
        ? message.susceptibility_tests.length
        : 0) +
      2,
    patients: message?.patient ? 1 : 0,
    requests: message?.lab_request ? 1 : 0,
    results: Array.isArray(message?.lab_results)
      ? message.lab_results.length
      : 0,
    isolates: Array.isArray(message?.isolates) ? message.isolates.length : 0,
    susceptibility_tests: Array.isArray(message?.susceptibility_tests)
      ? message.susceptibility_tests.length
      : 0,
  };
}

export type PersistProcessedMessageParams = {
  message: any;
  dataFeed: any;
  messageMetadata: any;
  kafkaKey: string;
  processedBody: string;
};

export async function persistProcessedMessageToExternal({
  message,
  dataFeed,
  messageMetadata,
  kafkaKey,
  processedBody,
}: PersistProcessedMessageParams) {
  const client = await externalPool.connect();

  try {
    await client.query("BEGIN");

    const facility = await upsertFacility(client, message, dataFeed);
    const dataSource = await upsertDataSource(
      client,
      message,
      dataFeed,
      facility.id,
    );
    const importBatch = await insertImportBatch(
      client,
      message,
      dataSource.id,
      messageMetadata,
      kafkaKey,
      processedBody,
    );
    const patient = await upsertPatient(
      client,
      message,
      facility.id,
      importBatch.id,
    );
    const request = await upsertLabRequest(
      client,
      message,
      patient.id,
      facility.id,
      importBatch.id,
    );

    await deleteExistingChildrenForRequest(client, request.id);

    const ordinaryResultIds = await insertLabResults(
      client,
      message,
      request.id,
      importBatch.id,
    );

    // Build map of organism lab_result IDs from already-inserted results
    const existingOrganismResultIds: Record<number, string> = {};
    const labResultRows = Array.isArray(message?.lab_results)
      ? message.lab_results
      : [];
    for (let i = 0; i < labResultRows.length; i++) {
      const row = labResultRows[i];
      // Check resolved concepts for an organism system
      const resolved = getResolvedConceptEntry(row, "observation_concept_id");
      const systemId = resolved?.system_id || row?.observation_code?.system_id || "";
      if (systemId.toLowerCase().includes("org")) {
        const idx = row?.isolate_index ?? 1;
        existingOrganismResultIds[idx] = ordinaryResultIds[i];
      }
    }

    const isolateInsert: any =
      (await insertIsolatesWithBackingResults(
        client,
        message,
        request.id,
        importBatch.id,
        ordinaryResultIds.length,
        existingOrganismResultIds,
      )) ?? {};

    const organismResultIdsByIndex =
      isolateInsert.organismResultIdsByIndex ?? {};
    const isolateIdsByIndex = isolateInsert.isolateIdsByIndex ?? {};

    const susceptibilityIds = await insertSusceptibilityTests(
      client,
      message,
      isolateInsert.isolateIdsByIndex,
      importBatch.id,
    );

    await client.query("COMMIT");

    return {
      facilityId: facility.id,
      dataSourceId: dataSource.id,
      importBatchId: importBatch.id,
      patientId: patient.id,
      requestId: request.id,
      labResultIds: [
        ...ordinaryResultIds,
        ...Object.values(organismResultIdsByIndex),
      ],
      isolateIds: Object.values(isolateIdsByIndex),
      susceptibilityTestIds: susceptibilityIds,
      recordIds: {
        facilities: [facility.id],
        data_sources: [dataSource.id],
        import_batches: [importBatch.id],
        patients: [patient.id],
        requests: [request.id],
        results: [
          ...ordinaryResultIds,
          ...Object.values(organismResultIdsByIndex),
        ],
        isolates: Object.values(isolateIdsByIndex),
        susceptibility_tests: susceptibilityIds,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertFacility(client: any, message: any, dataFeed: any) {
  const sourceFacility = message?.patient?.patient_data?.raw?.Facility || {};

  // Extract facility code from resolved concepts (added by terminology service)
  const resolvedFacility = (
    message?.lab_request?._resolved_concepts || []
  ).find((r: any) => r.source_field === "facility_code");

  const facilityCode =
    normalizeNullableString(sourceFacility?.Code) ||
    normalizeNullableString(message?._metadata?.facility?.facility_code) ||
    normalizeNullableString(resolvedFacility?.concept_code);
  const facilityName =
    normalizeNullableString(sourceFacility?.FacilityName) ||
    normalizeNullableString(message?._metadata?.facility?.facility_name) ||
    normalizeNullableString(resolvedFacility?.display_name) ||
    facilityCode;

  if (!facilityCode || !facilityName) {
    throw new Error(
      "Cannot persist processed message without a facility code/name",
    );
  }

  const facilityConceptId = message?.lab_request?.facility_concept_id || null;
  const metadata = {
    source_facility: sourceFacility,
    source_data_feed_id: dataFeed?.dataFeedId || null,
    source_facility_id: dataFeed?.facilityId || null,
    source_metadata_facility: message?._metadata?.facility || null,
    concept: facilityConceptId
      ? { facility_concept_id: facilityConceptId }
      : null,
  };

  const address =
    [
      normalizeNullableString(sourceFacility?.PostalAddress),
      normalizeNullableString(sourceFacility?.Street),
    ]
      .filter(Boolean)
      .join(", ") || null;

  const countryCode = normalizeCode(
    message?._metadata?.facility?.country_code,
    3,
  );
  const provinceCode = normalizeCode(
    message?._metadata?.facility?.province_code,
    3,
  );
  const cityCode = normalizeCode(
    message?._metadata?.facility?.district_code,
    3,
  );

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
      facility_name = EXCLUDED.facility_name,
      facility_type = COALESCE(EXCLUDED.facility_type, facilities.facility_type),
      country_code = COALESCE(EXCLUDED.country_code, facilities.country_code),
      region = COALESCE(EXCLUDED.region, facilities.region),
      district = COALESCE(EXCLUDED.district, facilities.district),
      province = COALESCE(EXCLUDED.province, facilities.province),
      city = COALESCE(EXCLUDED.city, facilities.city),
      address = COALESCE(EXCLUDED.address, facilities.address),
      facility_concept_id = COALESCE(EXCLUDED.facility_concept_id, facilities.facility_concept_id),
      metadata = COALESCE(facilities.metadata, '{}'::jsonb) || EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING id;
  `;

  const result = await client.query(sql, [
    facilityCode,
    facilityName,
    normalizeNullableString(sourceFacility?.District),
    normalizeNullableString(countryCode),
    normalizeNullableString(sourceFacility?.Region),
    normalizeNullableString(sourceFacility?.District),
    normalizeNullableString(provinceCode),
    normalizeNullableString(cityCode),
    address,
    asJson(metadata),
    facilityConceptId,
  ]);

  return result.rows[0];
}

async function upsertDataSource(
  client: any,
  message: any,
  dataFeed: any,
  facilityId: string,
) {
  const sql = `
    INSERT INTO data_sources (
      source_code,
      source_name,
      source_type,
      facility_id,
      description,
      config,
      updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6::jsonb,NOW()
    )
    ON CONFLICT (source_code)
    DO UPDATE SET
      source_name = EXCLUDED.source_name,
      source_type = EXCLUDED.source_type,
      facility_id = COALESCE(EXCLUDED.facility_id, data_sources.facility_id),
      description = COALESCE(EXCLUDED.description, data_sources.description),
      config = COALESCE(data_sources.config, '{}'::jsonb) || EXCLUDED.config,
      updated_at = NOW()
    RETURNING id;
  `;

  const config = {
    project_id: dataFeed?.projectId || null,
    use_case_id: dataFeed?.useCaseId || null,
    plugin_selection: message?._plugin_selection || {},
  };

  const result = await client.query(sql, [
    dataFeed?.dataFeedId,
    dataFeed?.dataFeedName || dataFeed?.dataFeedId,
    deriveSourceType(message),
    facilityId,
    "OpenLDR data-processing persisted feed",
    asJson(config),
  ]);

  return result.rows[0];
}

async function insertImportBatch(
  client: any,
  message: any,
  dataSourceId: string,
  messageMetadata: any,
  kafkaKey: string,
  processedBody: string,
) {
  const counts = summarizeRecords(message);
  const sql = `
    INSERT INTO import_batches (
      data_source_id,
      batch_status,
      filename,
      file_hash,
      file_storage_path,
      records_total,
      records_success,
      records_failed,
      started_at,
      completed_at,
      metadata
    ) VALUES (
      $1,'completed',$2,$3,$4,$5,$6,0,NOW(),NOW(),$7::jsonb
    )
    RETURNING id;
  `;

  const metadata = {
    kafka_key: kafkaKey,
    plugin_selection: message?._plugin_selection || {},
    processing_results: message?._processing_results || {},
    message_metadata: messageMetadata,
  };

  const result = await client.query(sql, [
    dataSourceId,
    messageMetadata?.FileName || kafkaKey,
    sha256(processedBody),
    messageMetadata?.FileName || kafkaKey,
    counts.total,
    counts.total,
    asJson(metadata),
  ]);

  return result.rows[0];
}

async function upsertPatient(
  client: any,
  message: any,
  facilityId: string,
  importBatchId: string,
) {
  const patient = message?.patient || {};
  const raw = patient?.patient_data?.raw || {};

  const sql = `
    INSERT INTO patients (
      patient_guid,
      facility_id,
      surname,
      firstname,
      date_of_birth,
      dob_estimated,
      sex,
      national_id,
      phone,
      email,
      encrypted_patient_id,
      patient_data,
      import_batch_id,
      source_system,
      updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,NOW()
    )
    ON CONFLICT (patient_guid, facility_id)
    DO UPDATE SET
      surname = COALESCE(EXCLUDED.surname, patients.surname),
      firstname = COALESCE(EXCLUDED.firstname, patients.firstname),
      date_of_birth = COALESCE(EXCLUDED.date_of_birth, patients.date_of_birth),
      dob_estimated = COALESCE(EXCLUDED.dob_estimated, patients.dob_estimated),
      sex = COALESCE(EXCLUDED.sex, patients.sex),
      national_id = COALESCE(EXCLUDED.national_id, patients.national_id),
      phone = COALESCE(EXCLUDED.phone, patients.phone),
      email = COALESCE(EXCLUDED.email, patients.email),
      encrypted_patient_id = COALESCE(EXCLUDED.encrypted_patient_id, patients.encrypted_patient_id),
      patient_data = COALESCE(patients.patient_data, '{}'::jsonb) || EXCLUDED.patient_data,
      import_batch_id = EXCLUDED.import_batch_id,
      source_system = EXCLUDED.source_system,
      updated_at = NOW()
    RETURNING id;
  `;

  const result = await client.query(sql, [
    normalizeNullableString(patient?.patient_guid),
    facilityId,
    normalizeNullableString(patient?.surname),
    normalizeNullableString(patient?.firstname),
    toIsoDate(patient?.date_of_birth || raw?.DobAge || null),
    patient?.dob_estimated ?? null,
    normalizeNullableString(patient?.sex),
    normalizeNullableString(patient?.national_id || raw?.NID),
    normalizeNullableString(patient?.phone) || null,
    normalizeNullableString(patient?.email) || null,
    normalizeNullableString(patient?.encrypted_patient_id) || null,
    asJson(patient),
    importBatchId,
    normalizeNullableString(message?._plugin?.source_system),
  ]);

  return result.rows[0];
}

async function upsertLabRequest(
  client: any,
  message: any,
  patientId: string,
  facilityId: string,
  importBatchId: string,
) {
  const request = message?.lab_request || {};
  const requestResolved = getResolvedConceptEntry(request, "panel_concept_id");
  const specimenResolved = getResolvedConceptEntry(
    request,
    "specimen_concept_id",
  );

  const sql = `
    INSERT INTO lab_requests (
      patient_id,
      facility_id,
      request_id,
      obr_set_id,
      panel_concept_id,
      panel_code,
      panel_system,
      panel_desc,
      specimen_datetime,
      specimen_concept_id,
      specimen_code,
      specimen_desc,
      specimen_site_code,
      specimen_site_desc,
      collection_volume,
      registered_at,
      received_at,
      analysis_at,
      authorised_at,
      priority,
      clinical_info,
      icd10_codes,
      diagnosis_concept_id,
      therapy,
      requesting_facility_concept_id,
      testing_facility_concept_id,
      requesting_doctor,
      tested_by,
      authorised_by,
      age_years,
      age_days,
      sex,
      patient_class,
      section_code,
      result_status,
      request_data,
      mappings,
      import_batch_id,
      source_system,
      updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36::jsonb,$37::jsonb,$38,$39,NOW()
    )
    ON CONFLICT (request_id, obr_set_id, facility_id)
    DO UPDATE SET
      patient_id = EXCLUDED.patient_id,
      panel_concept_id = COALESCE(EXCLUDED.panel_concept_id, lab_requests.panel_concept_id),
      panel_code = COALESCE(EXCLUDED.panel_code, lab_requests.panel_code),
      panel_system = COALESCE(EXCLUDED.panel_system, lab_requests.panel_system),
      panel_desc = COALESCE(EXCLUDED.panel_desc, lab_requests.panel_desc),
      specimen_datetime = COALESCE(EXCLUDED.specimen_datetime, lab_requests.specimen_datetime),
      specimen_concept_id = COALESCE(EXCLUDED.specimen_concept_id, lab_requests.specimen_concept_id),
      specimen_code = COALESCE(EXCLUDED.specimen_code, lab_requests.specimen_code),
      specimen_desc = COALESCE(EXCLUDED.specimen_desc, lab_requests.specimen_desc),
      specimen_site_code = COALESCE(EXCLUDED.specimen_site_code, lab_requests.specimen_site_code),
      specimen_site_desc = COALESCE(EXCLUDED.specimen_site_desc, lab_requests.specimen_site_desc),
      collection_volume = COALESCE(EXCLUDED.collection_volume, lab_requests.collection_volume),
      registered_at = COALESCE(EXCLUDED.registered_at, lab_requests.registered_at),
      received_at = COALESCE(EXCLUDED.received_at, lab_requests.received_at),
      analysis_at = COALESCE(EXCLUDED.analysis_at, lab_requests.analysis_at),
      authorised_at = COALESCE(EXCLUDED.authorised_at, lab_requests.authorised_at),
      priority = COALESCE(EXCLUDED.priority, lab_requests.priority),
      clinical_info = COALESCE(EXCLUDED.clinical_info, lab_requests.clinical_info),
      icd10_codes = COALESCE(EXCLUDED.icd10_codes, lab_requests.icd10_codes),
      diagnosis_concept_id = COALESCE(EXCLUDED.diagnosis_concept_id, lab_requests.diagnosis_concept_id),
      therapy = COALESCE(EXCLUDED.therapy, lab_requests.therapy),
      requesting_facility_concept_id = COALESCE(EXCLUDED.requesting_facility_concept_id, lab_requests.requesting_facility_concept_id),
      testing_facility_concept_id = COALESCE(EXCLUDED.testing_facility_concept_id, lab_requests.testing_facility_concept_id),
      requesting_doctor = COALESCE(EXCLUDED.requesting_doctor, lab_requests.requesting_doctor),
      tested_by = COALESCE(EXCLUDED.tested_by, lab_requests.tested_by),
      authorised_by = COALESCE(EXCLUDED.authorised_by, lab_requests.authorised_by),
      age_years = COALESCE(EXCLUDED.age_years, lab_requests.age_years),
      age_days = COALESCE(EXCLUDED.age_days, lab_requests.age_days),
      sex = COALESCE(EXCLUDED.sex, lab_requests.sex),
      patient_class = COALESCE(EXCLUDED.patient_class, lab_requests.patient_class),
      section_code = COALESCE(EXCLUDED.section_code, lab_requests.section_code),
      result_status = COALESCE(EXCLUDED.result_status, lab_requests.result_status),
      request_data = COALESCE(lab_requests.request_data, '{}'::jsonb) || EXCLUDED.request_data,
      mappings = COALESCE(lab_requests.mappings, '{}'::jsonb) || EXCLUDED.mappings,
      import_batch_id = EXCLUDED.import_batch_id,
      source_system = EXCLUDED.source_system,
      updated_at = NOW()
    RETURNING id;
  `;

  const result = await client.query(sql, [
    patientId,
    facilityId,
    normalizeNullableString(request?.request_id),
    request?.obr_set_id ?? 1,
    request?.panel_concept_id || null,
    requestResolved?.concept_code || null,
    requestResolved?.system_id || null,
    requestResolved?.display_name || null,
    toIsoTimestamp(request?.specimen_datetime || request?.taken_datetime || request?.collected_datetime),
    request?.specimen_concept_id || null,
    specimenResolved?.concept_code || null,
    specimenResolved?.display_name || null,
    normalizeNullableString(request?.specimen_site_code) || null,
    normalizeNullableString(request?.specimen_site_desc) || null,
    request?.collection_volume != null ? Number(request.collection_volume) : null,
    toIsoTimestamp(request?.registered_at || request?.registered_datetime),
    toIsoTimestamp(request?.received_at || request?.received_in_lab_datetime),
    toIsoTimestamp(request?.analysis_at) || null,
    toIsoTimestamp(request?.authorised_at) || null,
    normalizeNullableString(request?.priority) || null,
    normalizeNullableString(request?.clinical_info || request?.clinical_diagnosis) || null,
    normalizeNullableString(request?.icd10_codes) || null,
    request?.diagnosis_concept_id || null,
    normalizeNullableString(request?.therapy) || null,
    request?.requesting_facility_concept_id || null,
    request?.testing_facility_concept_id || null,
    normalizeNullableString(request?.requesting_doctor) || null,
    normalizeNullableString(request?.tested_by) || null,
    normalizeNullableString(request?.authorised_by) || null,
    request?.age_years != null ? Number(request.age_years) : null,
    request?.age_days != null ? Number(request.age_days) : null,
    normalizeNullableString(request?.sex) || null,
    normalizeNullableString(request?.patient_class) || null,
    normalizeNullableString(request?.section_code) || null,
    normalizeNullableString(request?.result_status) || null,
    asJson(request),
    asJson({
      resolved_concepts: request?._resolved_concepts || [],
      mapping_results: message?._mapping_results || {},
    }),
    importBatchId,
    normalizeNullableString(message?._plugin?.source_system),
  ]);

  return result.rows[0];
}

async function deleteExistingChildrenForRequest(
  client: any,
  requestId: string,
) {
  await client.query(
    `DELETE FROM susceptibility_tests WHERE isolate_id IN (SELECT id FROM isolates WHERE request_id = $1)`,
    [requestId],
  );
  await client.query(`DELETE FROM isolates WHERE request_id = $1`, [requestId]);
  await client.query(`DELETE FROM lab_results WHERE request_id = $1`, [
    requestId,
  ]);
}

function buildLabResultParams(
  row: any,
  requestId: string,
  obxSetId: number,
  importBatchId: string,
  resultDataOverride?: any,
) {
  const observation = getResolvedConceptEntry(row, "observation_concept_id");
  const values = buildValueColumns(row);

  return {
    sql: `
      INSERT INTO lab_results (
        request_id,
        obx_set_id,
        obx_sub_id,
        observation_concept_id,
        observation_code,
        observation_system,
        observation_desc,
        result_type,
        numeric_value,
        numeric_units,
        numeric_lo_range,
        numeric_hi_range,
        coded_value,
        text_value,
        datetime_value,
        abnormal_flag,
        rpt_result,
        rpt_units,
        rpt_flag,
        rpt_range,
        semiquantitative,
        work_units,
        cost_units,
        result_timestamp,
        result_data,
        import_batch_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,$26
      ) RETURNING id;
    `,
    values: [
      requestId,
      obxSetId,
      row?.obx_sub_id ?? null,
      row?.observation_concept_id || null,
      observation?.concept_code || null,
      observation?.system_id || null,
      observation?.display_name || null,
      values.resultType,
      values.numericValue,
      normalizeNullableString(row?.numeric_units) || null,
      row?.numeric_lo_range != null ? Number(row.numeric_lo_range) : null,
      row?.numeric_hi_range != null ? Number(row.numeric_hi_range) : null,
      values.codedValue,
      values.textValue,
      row?.datetime_value || null,
      normalizeNullableString(row?.abnormal_flag) || null,
      values.rptResult,
      normalizeNullableString(row?.rpt_units) || null,
      normalizeNullableString(row?.rpt_flag) || null,
      normalizeNullableString(row?.rpt_range) || null,
      row?.semiquantitative != null ? Number(row.semiquantitative) : null,
      row?.work_units != null ? Number(row.work_units) : null,
      row?.cost_units != null ? Number(row.cost_units) : null,
      row?.result_timestamp || null,
      asJson(resultDataOverride ?? row),
      importBatchId,
    ],
  };
}

async function insertLabResults(
  client: any,
  message: any,
  requestId: string,
  importBatchId: string,
) {
  const resultIds: string[] = [];
  const rows = Array.isArray(message?.lab_results) ? message.lab_results : [];

  for (let index = 0; index < rows.length; index += 1) {
    const params = buildLabResultParams(
      rows[index],
      requestId,
      rows[index]?.obx_set_id ?? index + 1,
      importBatchId,
    );
    const inserted = await client.query(params.sql, params.values);
    resultIds.push(inserted.rows[0].id);
  }

  return resultIds;
}

type IsolateInsertResult = {
  organismResultIdsByIndex: Record<number, string>;
  isolateIdsByIndex: Record<number, string>;
};

async function insertIsolatesWithBackingResults(
  client: any,
  message: any,
  requestId: string,
  importBatchId: string,
  labResultCount: number,
  existingOrganismResultIds: Record<number, string> = {},
): Promise<IsolateInsertResult> {
  const organismResultIdsByIndex: Record<number, string> = {};
  const isolateIdsByIndex: Record<number, string> = {};
  const isolates = Array.isArray(message?.isolates) ? message.isolates : [];
  const request = message?.lab_request || {};
  const specimenResolved = getResolvedConceptEntry(
    request,
    "specimen_concept_id",
  );

  for (const isolate of isolates) {
    const isolateIndex = Number(isolate?.isolate_index);
    const sourceObservation = getResolvedConceptEntry(
      isolate,
      "source_observation_concept_id",
    );
    const organismResolved = getResolvedConceptEntry(
      isolate,
      "organism_concept_id",
    );

    // Skip backing result creation if the plugin already provided an organism lab_result
    if (existingOrganismResultIds[isolateIndex]) {
      organismResultIdsByIndex[isolateIndex] = existingOrganismResultIds[isolateIndex];
    } else {
      // Use source_observation if available, fall back to organism concept
      const obsEntry = sourceObservation || organismResolved;
      const obsConceptId =
        isolate?.source_observation_concept_id ||
        isolate?.organism_concept_id ||
        null;

      // Build a row-like object so buildLabResultParams can handle it generically
      const isolateRow = {
        ...isolate,
        obx_sub_id: isolate?.obx_sub_id ?? 1,
        observation_concept_id: obsConceptId,
        _resolved_concepts: [
          ...(Array.isArray(isolate?._resolved_concepts) ? isolate._resolved_concepts : []),
          ...(obsEntry ? [{
            ...obsEntry,
            target_field: "observation_concept_id",
          }] : []),
        ],
        result_type: isolate?.result_type ?? isolate?.raw_result?.ResultType ?? isolate?.raw_result?.Type,
        result_value:
          isolate?.result_value ??
          isolate?.raw_result?.Value ??
          organismResolved?.display_name,
      };

      const params = buildLabResultParams(
        isolateRow,
        requestId,
        labResultCount + isolateIndex,
        importBatchId,
        { kind: "organism_reporting_result", isolate },
      );

      const organismResult = await client.query(params.sql, params.values);
      organismResultIdsByIndex[isolateIndex] = organismResult.rows[0].id;
    }

    const isolateSql = `
      INSERT INTO isolates (
        lab_result_id,
        request_id,
        organism_concept_id,
        organism_code,
        organism_name,
        specimen_concept_id,
        specimen_code,
        specimen_date,
        isolate_number,
        serotype,
        organism_type,
        beta_lactamase,
        esbl,
        carbapenemase,
        mrsa_screen,
        inducible_clinda,
        patient_age_days,
        patient_sex,
        ward,
        ward_type,
        origin,
        prior_antibiotics,
        custom_fields,
        raw_data,
        import_batch_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24::jsonb,$25
      ) RETURNING id;
    `;

    const isolateInsert = await client.query(isolateSql, [
      organismResultIdsByIndex[isolateIndex],
      requestId,
      isolate?.organism_concept_id || null,
      organismResolved?.concept_code || null,
      organismResolved?.display_name || null,
      request?.specimen_concept_id || null,
      specimenResolved?.concept_code || null,
      toIsoDate(request?.taken_datetime || request?.collected_datetime),
      normalizeNullableString(isolate?.isolate_number) || null,
      normalizeNullableString(isolate?.serotype) || null,
      normalizeNullableString(isolate?.organism_type) || null,
      normalizeNullableString(isolate?.beta_lactamase) || null,
      normalizeNullableString(isolate?.esbl) || null,
      normalizeNullableString(isolate?.carbapenemase) || null,
      normalizeNullableString(isolate?.mrsa_screen) || null,
      normalizeNullableString(isolate?.inducible_clinda) || null,
      isolate?.patient_age_days != null ? Number(isolate.patient_age_days) : null,
      normalizeNullableString(isolate?.patient_sex) || null,
      normalizeNullableString(isolate?.ward) || null,
      normalizeNullableString(isolate?.ward_type) || null,
      normalizeNullableString(isolate?.origin) || null,
      normalizeNullableString(isolate?.prior_antibiotics) || null,
      asJson(isolate?.custom_fields || {}),
      asJson(isolate),
      importBatchId,
    ]);

    isolateIdsByIndex[isolateIndex] = isolateInsert.rows[0].id;
  }

  return { isolateIdsByIndex, organismResultIdsByIndex };
}

async function insertSusceptibilityTests(
  client: any,
  message: any,
  isolateIdsByIndex: Record<number, string>,
  importBatchId: string,
) {
  const susceptibilityIds: string[] = [];
  const rows = Array.isArray(message?.susceptibility_tests)
    ? message.susceptibility_tests
    : [];

  for (const row of rows) {
    const isolateIndex = Number(row?.isolate_index);
    const isolateId = isolateIdsByIndex[isolateIndex];
    if (!isolateId) {
      throw new Error(
        `Susceptibility test isolate_index ${isolateIndex} has no persisted isolate`,
      );
    }

    const antibiotic = getResolvedConceptEntry(row, "antibiotic_concept_id");
    const sql = `
      INSERT INTO susceptibility_tests (
        isolate_id,
        antibiotic_concept_id,
        antibiotic_code,
        antibiotic_name,
        test_method,
        disk_potency,
        result_raw,
        result_numeric,
        interpretation,
        guideline,
        guideline_version,
        import_batch_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      ) RETURNING id;
    `;

    const inserted = await client.query(sql, [
      isolateId,
      row?.antibiotic_concept_id || null,
      antibiotic?.concept_code || null,
      antibiotic?.display_name || null,
      normalizeNullableString(row?.test_method) || null,
      normalizeNullableString(row?.disk_potency) || null,
      normalizeNullableString(row?.result_raw ?? row?.raw_result?.Value ?? row?.susceptibility_value),
      row?.result_numeric != null ? row.result_numeric : null,
      normalizeNullableString(row?.susceptibility_value),
      normalizeNullableString(row?.guideline) || null,
      normalizeNullableString(row?.guideline_version) || null,
      importBatchId,
    ]);

    susceptibilityIds.push(inserted.rows[0].id);
  }

  return susceptibilityIds;
}
