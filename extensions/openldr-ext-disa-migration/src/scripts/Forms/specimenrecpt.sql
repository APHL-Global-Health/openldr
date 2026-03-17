-- =============================================================================
-- Specimen Receipt: Composite query mirroring api/src/lib/Forms/specimenrecpt.js
-- =============================================================================
-- Three entry points:
--   disa.specimen_receipt(text)         — single lab number (5 FDW round-trips)
--   disa.specimen_receipt_bulk(text[])  — CTE-based batch (5 FDW queries)
--   disa.specimen_receipt_migrate(text[]) — temp-table based, optimized for 45M+ rows
-- =============================================================================

-- #############################################################################
-- 1. SINGLE-ROW FUNCTION (unchanged — optimized for WHERE pushdown)
-- #############################################################################
CREATE OR REPLACE FUNCTION disa.specimen_receipt(p_labno text)
RETURNS TABLE(
    lab_number text,
    inner_lab_number text,
    reference_number text,
    registered_datetime timestamp,
    unique_id text,
    nid text,
    facility_code text,
    facility_name text,
    facility_postal1 text,
    facility_postal2 text,
    facility_postal3 text,
    facility_postal4 text,
    ward_clinic text,
    folder_no text,
    last_name text,
    first_name text,
    sex text,
    dob_age date,
    phone text,
    work text,
    mobile text,
    email text,
    address text,
    icd10 text,
    therapy text,
    therapy_text text,
    notes text,
    notes_text text,
    clinical_diagnosis text,
    clinical_diagnosis_text text,
    specimen text,
    specimen_info text,
    condition text,
    taken_datetime text,
    taken_by text,
    collected_datetime timestamp,
    collected_by text,
    received_in_lab_datetime timestamp,
    received_in_lab_by text,
    priority text,
    doctor_code text,
    doctor text,
    doctor_phone text,
    doctor_fax text,
    doctor_mobile text,
    doctor_email text,
    receipt text,
    amount bigint,
    paid_by text,
    test_order_codes text[],
    test_order_descriptions text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_raw bytea;
    v_data text;
    loc record;
    txt record;
    v_last_name text;
    v_first_name text;
    v_phone text;
    v_work text;
    v_mobile text;
    v_email text;
    v_icd10 text;
    v_therapy_text text;
    v_notes_text text;
    v_diag_cln_text text;
    v_specimen_text text;
    v_postal1 text;
    v_postal2 text;
    v_postal3 text;
    v_taken_by text;
    v_collected_by text;
    v_received_by text;
    v_dr_phone text;
    v_dr_fax text;
    v_dr_mobile text;
    v_dr_email text;
    v_dob date;
    v_taken_date text;
    v_test_codes text[] := '{}';
    v_test_descs text[] := '{}';
    v_test_code text;
    v_test_desc text;
    v_audit_data text;
    v_reg_index text;
    v_unique_id text;
    v_registered_dt timestamp;
    v_reference_number text;
    v_received_in_lab_dt timestamp;
    v_collected_dt timestamp;
    v_taken_dt timestamp;
    v_received_by_reg text;
    v_modified_by text;
    v_inner_lab_number text;
    v_nid text;
    v_location text;
    v_ward_clinic text;
    v_folder_number text;
    v_name text;
    v_dob_age date;
    v_sex text;
    v_surname text;
    v_middlename text;
    v_firstname text;
    v_specimen text;
    v_condition text;
    v_priority text;
    v_therapy text;
    v_notes text;
    v_diag_cln text;
    v_ref_dr_id text;
    v_ref_dr text;
    v_receipt text;
    v_amount bigint;
    v_paid_by text;
BEGIN
    SELECT ft."REGDAT4_STATUS"
    INTO v_raw
    FROM disalab_data.regdat4 ft
    WHERE ft."LabNo" = p_labno
    LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF;

    v_data := disa.fix_bytes(v_raw);

    v_reg_index          := trim(disa.fix_string(v_data, 5, 8));
    v_unique_id          := trim(disa.fix_string(v_data, 32, 41));
    v_registered_dt      := disa.datetime_value(v_raw, 126, 130, 131, 134);
    v_reference_number   := trim(disa.fix_string(v_data, 66, 121));
    v_received_in_lab_dt := disa.datetime_value(v_raw, 666, 670, 154, 157);
    v_collected_dt       := disa.datetime_value(v_raw, 159, 163, 163, 165);
    v_taken_dt           := disa.datetime_short_value(v_raw, 615, 619);
    v_received_by_reg    := trim(disa.fix_string(v_data, 135, 138));
    v_modified_by        := trim(disa.fix_string(v_data, 139, 142));
    v_inner_lab_number   := trim(disa.fix_string(v_data, 12, 22));
    v_nid                := trim(disa.fix_string(v_data, 393, 408));
    v_location           := trim(disa.fix_string(v_data, 421, 426));
    v_ward_clinic        := trim(disa.fix_string(v_data, 442, 448));
    v_folder_number      := trim(disa.fix_string(v_data, 427, 442));
    v_name               := trim(disa.fix_string(v_data, 348, 392));
    v_dob_age            := disa.dob_or_age_value(v_raw, 159, 163, 163, 165);
    v_sex                := trim(disa.fix_string(v_data, 420, 421));
    v_surname            := split_part(v_name, ',', 1);
    v_middlename         := split_part(v_name, ',', 2);
    v_firstname          := split_part(v_name, ',', 3);
    v_specimen           := trim(disa.fix_string(v_data, 148, 153));
    v_condition          := trim(disa.fix_string(v_data, 548, 553));
    v_priority           := trim(disa.fix_string(v_data, 186, 187));
    v_therapy            := trim(disa.fix_string(v_data, 340, 344));
    v_notes              := trim(disa.fix_string(v_data, 174, 179));
    v_diag_cln           := trim(disa.fix_string(v_data, 334, 339));
    v_ref_dr_id          := trim(disa.fix_string(v_data, 507, 511));
    v_ref_dr             := trim(disa.fix_string(v_data, 513, 548));
    v_receipt            := trim(disa.fix_string(v_data, 653, 665));
    v_amount             := disa.to_uint32(v_raw, 61, 65);
    v_paid_by            := trim(disa.fix_string(v_data, 482, 507));

    v_test_codes := disa.regdat4_tests(v_raw);

    v_last_name := v_surname;
    v_first_name := v_firstname;

    SELECT trim(disa.fix_string_raw(a."AUDTDATA_STATUS", 36, 66))
    INTO v_audit_data
    FROM disalab_data.audtdata a
    WHERE a."LABNO" = p_labno
        AND trim(disa.fix_string_raw(a."AUDTDATA_STATUS", 19, 24)) = 'WS203'
    ORDER BY a."DATESTAMP" DESC
    LIMIT 1;

    IF v_audit_data IS NOT NULL AND v_audit_data != '' THEN
        v_last_name  := split_part(v_audit_data, ',', 1);
        v_first_name := split_part(v_audit_data, ',', 3);
    END IF;

    IF nullif(trim(v_last_name), '') IS NULL THEN v_last_name := v_surname; END IF;
    IF nullif(trim(v_first_name), '') IS NULL THEN v_first_name := v_firstname; END IF;

    v_phone := NULL; v_work := NULL; v_mobile := NULL; v_email := NULL;
    v_icd10 := NULL; v_therapy_text := NULL; v_notes_text := NULL;
    v_diag_cln_text := NULL; v_specimen_text := NULL;
    v_postal1 := NULL; v_postal2 := NULL; v_postal3 := NULL;
    v_taken_by := NULL; v_collected_by := NULL; v_received_by := NULL;
    v_dr_phone := NULL; v_dr_fax := NULL; v_dr_mobile := NULL; v_dr_email := NULL;

    FOR txt IN
        SELECT
            t."TESTCODE" AS testcode,
            t."FRAMEREF" AS frameref,
            CASE
                WHEN octet_length(t."TXT1DATA_STATUS") > 16
                THEN disa.fix_string_raw(t."TXT1DATA_STATUS", 16,
                     octet_length(t."TXT1DATA_STATUS"))
                ELSE NULL
            END AS value
        FROM disalab_data.txt1data t
        WHERE t."LABNO" = p_labno
    LOOP
        IF txt.value IS NULL OR trim(txt.value) = '' THEN CONTINUE; END IF;

        CASE txt.frameref
            WHEN 63 THEN
                v_collected_by := trim(split_part(txt.value, '|', 1));
                v_taken_by     := trim(split_part(txt.value, '|', 2));
                v_received_by  := trim(split_part(txt.value, '|', 3));
            WHEN 61 THEN
                v_phone  := trim(split_part(txt.value, '|', 1));
                v_work   := trim(split_part(txt.value, '|', 2));
                v_mobile := trim(split_part(txt.value, '|', 3));
                v_email  := trim(split_part(txt.value, '|', 4));
            WHEN 53 THEN
                v_dr_mobile := trim(split_part(txt.value, '|', 3));
                v_dr_email  := trim(split_part(txt.value, '|', 4));
            WHEN 52 THEN
                v_dr_phone := trim(split_part(txt.value, '|', 3));
                v_dr_fax   := trim(split_part(txt.value, '|', 5));
            WHEN 48, 49 THEN
                IF trim(txt.testcode) = '.....' THEN v_postal3 := trim(txt.value); END IF;
            WHEN 47 THEN
                IF trim(txt.testcode) = '.....' THEN v_postal2 := trim(txt.value); END IF;
            WHEN 46 THEN
                IF trim(txt.testcode) = '.....' THEN v_postal1 := trim(txt.value); END IF;
            WHEN 31 THEN
                IF trim(txt.testcode) = '.....' THEN v_notes_text := trim(txt.value); END IF;
            WHEN 21 THEN
                IF trim(txt.testcode) = '.....' THEN v_therapy_text := trim(txt.value); END IF;
            WHEN 12 THEN
                IF trim(txt.testcode) = '.....' THEN v_diag_cln_text := trim(txt.value); END IF;
            WHEN 11 THEN
                IF trim(txt.testcode) = '.....' THEN v_icd10 := trim(txt.value); END IF;
            WHEN 1 THEN
                IF trim(txt.testcode) = '.....' THEN v_specimen_text := trim(txt.value); END IF;
            ELSE
                NULL;
        END CASE;
    END LOOP;

    SELECT d."DOBDATE"::date INTO v_dob
    FROM disalab_data.rdobidx4 d
    WHERE d."LABNO" = p_labno
    LIMIT 1;

    IF v_dob IS NULL THEN v_dob := v_dob_age; END IF;

    SELECT tk."TAKENDATE" INTO v_taken_date
    FROM disalab_data.rtknidx5 tk
    WHERE tk."INVOICENO" = p_labno
    LIMIT 1;

    IF v_taken_date IS NULL THEN v_taken_date := v_taken_dt::text; END IF;

    IF v_location IS NOT NULL AND v_location != '' THEN
        SELECT l.* INTO loc FROM disa.locndic4 l WHERE l.code = v_location LIMIT 1;
    END IF;

    IF v_test_codes IS NOT NULL THEN
        FOREACH v_test_code IN ARRAY v_test_codes LOOP
            SELECT tdict.description INTO v_test_desc
            FROM disa.testdict tdict
            WHERE tdict.code = v_test_code LIMIT 1;

            v_test_descs := array_append(v_test_descs, v_test_desc);
        END LOOP;
    END IF;

    RETURN QUERY SELECT
        p_labno,
        nullif(v_inner_lab_number, ''),
        nullif(v_reference_number, ''),
        v_registered_dt,
        nullif(v_unique_id, ''),
        nullif(v_nid, ''),
        COALESCE(loc.code, v_location),
        loc.description,
        loc.postal_address1,
        loc.postal_address2,
        loc.postal_address3,
        loc.postal_address4,
        nullif(v_ward_clinic, ''),
        nullif(v_folder_number, ''),
        nullif(trim(v_last_name), ''),
        nullif(trim(v_first_name), ''),
        nullif(v_sex, ''),
        v_dob,
        nullif(v_phone, ''),
        nullif(v_work, ''),
        nullif(v_mobile, ''),
        nullif(v_email, ''),
        CASE
            WHEN v_postal1 IS NULL AND v_postal2 IS NULL AND v_postal3 IS NULL THEN NULL
            ELSE concat_ws(E'\r\n',
                COALESCE(v_postal1, ''),
                COALESCE(v_postal2, ''),
                COALESCE(v_postal3, ''))
        END,
        v_icd10,
        nullif(v_therapy, ''),
        v_therapy_text,
        nullif(v_notes, ''),
        v_notes_text,
        nullif(v_diag_cln, ''),
        v_diag_cln_text,
        nullif(v_specimen, ''),
        v_specimen_text,
        nullif(v_condition, ''),
        v_taken_date,
        nullif(v_taken_by, ''),
        v_collected_dt,
        nullif(v_collected_by, ''),
        v_received_in_lab_dt,
        nullif(v_received_by, ''),
        nullif(v_priority, ''),
        nullif(v_ref_dr_id, ''),
        nullif(v_ref_dr, ''),
        nullif(v_dr_phone, ''),
        nullif(v_dr_fax, ''),
        nullif(v_dr_mobile, ''),
        nullif(v_dr_email, ''),
        nullif(v_receipt, ''),
        v_amount,
        nullif(v_paid_by, ''),
        v_test_codes,
        v_test_descs;
END;
$$;

-- #############################################################################
-- 2. MIGRATION FUNCTION — optimized for 45M+ rows
-- #############################################################################
-- Optimizations vs. the CTE bulk version:
--   1. C extension for _replace_null_bytes (nanoseconds vs milliseconds)
--   2. fix_string_raw for AUDTDATA/TXT1DATA (decode 5-50 bytes, not 700)
--   3. LATERAL subquery merges blob decode + field extraction into one pass
--      (avoids writing full decoded text to disk in a separate temp table)
--   4. Increased work_mem for sort/hash operations
--   5. Staged temp tables with indexes for fast joins
-- =============================================================================
CREATE OR REPLACE FUNCTION disa.specimen_receipt_migrate(p_labnos text[] DEFAULT NULL)
RETURNS TABLE(
    lab_number text,
    inner_lab_number text,
    reference_number text,
    registered_datetime timestamp,
    unique_id text,
    nid text,
    facility_code text,
    facility_name text,
    facility_postal1 text,
    facility_postal2 text,
    facility_postal3 text,
    facility_postal4 text,
    ward_clinic text,
    folder_no text,
    last_name text,
    first_name text,
    sex text,
    dob_age date,
    phone text,
    work text,
    mobile text,
    email text,
    address text,
    icd10 text,
    therapy text,
    therapy_text text,
    notes text,
    notes_text text,
    clinical_diagnosis text,
    clinical_diagnosis_text text,
    specimen text,
    specimen_info text,
    condition text,
    taken_datetime text,
    taken_by text,
    collected_datetime timestamp,
    collected_by text,
    received_in_lab_datetime timestamp,
    received_in_lab_by text,
    priority text,
    doctor_code text,
    doctor text,
    doctor_phone text,
    doctor_fax text,
    doctor_mobile text,
    doctor_email text,
    receipt text,
    amount bigint,
    paid_by text,
    test_order_codes text[],
    test_order_descriptions text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_count bigint;
    v_start timestamptz;
BEGIN
    v_start := clock_timestamp();

    -- =================================================================
    -- Tuning: increase work_mem for large hash joins and sorts
    -- =================================================================
    SET LOCAL work_mem = '512MB';

    -- =================================================================
    -- Stage 1: Pull raw FDW data into temp tables (5 FDW fetches)
    -- =================================================================
    RAISE NOTICE 'Stage 1: Fetching REGDAT4...';
    CREATE TEMP TABLE _mig_reg ON COMMIT DROP AS
    SELECT ft."LabNo" AS labno, ft."REGDAT4_STATUS" AS raw
    FROM disalab_data.regdat4 ft
    WHERE p_labnos IS NULL OR ft."LabNo" = ANY(p_labnos);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  → % rows (% elapsed)', v_count, clock_timestamp() - v_start;

    RAISE NOTICE 'Stage 1: Fetching AUDTDATA...';
    CREATE TEMP TABLE _mig_aud ON COMMIT DROP AS
    SELECT a."LABNO" AS labno, a."DATESTAMP" AS datestamp, a."AUDTDATA_STATUS" AS raw
    FROM disalab_data.audtdata a
    WHERE p_labnos IS NULL OR a."LABNO" = ANY(p_labnos);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  → % rows (% elapsed)', v_count, clock_timestamp() - v_start;

    RAISE NOTICE 'Stage 1: Fetching TXT1DATA...';
    CREATE TEMP TABLE _mig_txt ON COMMIT DROP AS
    SELECT t."LABNO" AS labno, t."FRAMEREF" AS fr, t."TESTCODE" AS tc, t."TXT1DATA_STATUS" AS raw
    FROM disalab_data.txt1data t
    WHERE p_labnos IS NULL OR t."LABNO" = ANY(p_labnos);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  → % rows (% elapsed)', v_count, clock_timestamp() - v_start;

    RAISE NOTICE 'Stage 1: Fetching RDOBIDX4...';
    CREATE TEMP TABLE _mig_dob ON COMMIT DROP AS
    SELECT DISTINCT ON (d."LABNO") d."LABNO" AS labno, d."DOBDATE"::date AS dob_val
    FROM disalab_data.rdobidx4 d
    WHERE p_labnos IS NULL OR d."LABNO" = ANY(p_labnos)
    ORDER BY d."LABNO";
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  → % rows (% elapsed)', v_count, clock_timestamp() - v_start;

    RAISE NOTICE 'Stage 1: Fetching RTKNIDX5...';
    CREATE TEMP TABLE _mig_tkn ON COMMIT DROP AS
    SELECT DISTINCT ON (tk."INVOICENO") tk."INVOICENO" AS labno, tk."TAKENDATE" AS taken_date_val
    FROM disalab_data.rtknidx5 tk
    WHERE p_labnos IS NULL OR tk."INVOICENO" = ANY(p_labnos)
    ORDER BY tk."INVOICENO";
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  → % rows (% elapsed)', v_count, clock_timestamp() - v_start;

    -- =================================================================
    -- Stage 2: Parse blobs locally
    -- =================================================================

    -- REGDAT4: decode blob ONCE via LATERAL, extract all fields in single pass.
    -- Avoids writing full decoded text to a separate temp table.
    RAISE NOTICE 'Stage 2: Parsing REGDAT4 (single-pass via LATERAL)...';
    CREATE TEMP TABLE _mig_reg_fields ON COMMIT DROP AS
    SELECT
        r.labno,
        -- Date/time fields (directly from bytea — no text decode needed)
        disa.datetime_value(r.raw, 126, 130, 131, 134)                     AS registered_dt,
        disa.datetime_value(r.raw, 666, 670, 154, 157)                     AS received_in_lab_dt,
        disa.datetime_value(r.raw, 159, 163, 163, 165)                     AS collected_dt,
        disa.datetime_short_value(r.raw, 615, 619)                         AS taken_dt,
        disa.dob_or_age_value(r.raw, 159, 163, 163, 165)                   AS dob_age_val,
        disa.to_uint32(r.raw, 61, 65)                                      AS amount_val,
        disa.regdat4_tests(r.raw)                                          AS test_codes,
        -- Text fields: fix_bytes ONCE (d.data), then substring 30x (cheap)
        nullif(trim(substring(d.data FROM 13 FOR 10)), '')                 AS inner_lab_no,
        nullif(trim(substring(d.data FROM 67 FOR 55)), '')                 AS ref_number,
        nullif(trim(substring(d.data FROM 33 FOR 9)), '')                  AS unique_id_val,
        nullif(trim(substring(d.data FROM 394 FOR 15)), '')                AS nid_val,
        nullif(trim(substring(d.data FROM 422 FOR 5)), '')                 AS location_code,
        nullif(trim(substring(d.data FROM 443 FOR 6)), '')                 AS ward_clinic_val,
        nullif(trim(substring(d.data FROM 428 FOR 15)), '')                AS folder_no_val,
        nullif(trim(substring(d.data FROM 421 FOR 1)), '')                 AS sex_val,
        nullif(trim(substring(d.data FROM 149 FOR 5)), '')                 AS specimen_val,
        nullif(trim(substring(d.data FROM 549 FOR 5)), '')                 AS condition_val,
        nullif(trim(substring(d.data FROM 187 FOR 1)), '')                 AS priority_val,
        nullif(trim(substring(d.data FROM 341 FOR 4)), '')                 AS therapy_val,
        nullif(trim(substring(d.data FROM 175 FOR 5)), '')                 AS notes_val,
        nullif(trim(substring(d.data FROM 335 FOR 5)), '')                 AS diag_cln_val,
        nullif(trim(substring(d.data FROM 508 FOR 4)), '')                 AS ref_dr_id_val,
        nullif(trim(substring(d.data FROM 514 FOR 35)), '')                AS ref_dr_val,
        nullif(trim(substring(d.data FROM 654 FOR 12)), '')                AS receipt_val,
        nullif(trim(substring(d.data FROM 483 FOR 25)), '')                AS paid_by_val,
        split_part(trim(substring(d.data FROM 349 FOR 44)), ',', 1)        AS surname,
        split_part(trim(substring(d.data FROM 349 FOR 44)), ',', 3)        AS firstname
    FROM _mig_reg r
    CROSS JOIN LATERAL (SELECT disa.fix_bytes(r.raw) AS data) d;
    CREATE INDEX ON _mig_reg_fields(labno);
    CREATE INDEX ON _mig_reg_fields(location_code) WHERE location_code IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  → % rows parsed (% elapsed)', v_count, clock_timestamp() - v_start;

    -- Free raw blobs from memory immediately
    DROP TABLE _mig_reg;

    -- AUDTDATA: use fix_string_raw to decode ONLY 5 bytes for WS203 check,
    -- and 30 bytes for audit name — NOT the full blob.
    RAISE NOTICE 'Stage 2: Parsing AUDTDATA (targeted via fix_string_raw)...';
    CREATE TEMP TABLE _mig_aud_parsed ON COMMIT DROP AS
    SELECT DISTINCT ON (labno)
        labno,
        trim(disa.fix_string_raw(raw, 36, 66)) AS audit_name
    FROM _mig_aud
    WHERE trim(disa.fix_string_raw(raw, 19, 24)) = 'WS203'
    ORDER BY labno, datestamp DESC;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  → % WS203 rows (% elapsed)', v_count, clock_timestamp() - v_start;

    DROP TABLE _mig_aud;

    -- TXT1DATA: pivot frameref→columns using fix_string_raw (not fix_bytes)
    RAISE NOTICE 'Stage 2: Pivoting TXT1DATA (fix_string_raw)...';
    CREATE TEMP TABLE _mig_txt_pivot ON COMMIT DROP AS
    SELECT
        sub.labno,
        max(CASE WHEN sub.fr = 63 THEN trim(split_part(sub.val, '|', 1)) END)             AS collected_by_val,
        max(CASE WHEN sub.fr = 63 THEN trim(split_part(sub.val, '|', 2)) END)             AS taken_by_val,
        max(CASE WHEN sub.fr = 63 THEN trim(split_part(sub.val, '|', 3)) END)             AS received_by_val,
        max(CASE WHEN sub.fr = 61 THEN trim(split_part(sub.val, '|', 1)) END)             AS phone_val,
        max(CASE WHEN sub.fr = 61 THEN trim(split_part(sub.val, '|', 2)) END)             AS work_val,
        max(CASE WHEN sub.fr = 61 THEN trim(split_part(sub.val, '|', 3)) END)             AS mobile_val,
        max(CASE WHEN sub.fr = 61 THEN trim(split_part(sub.val, '|', 4)) END)             AS email_val,
        max(CASE WHEN sub.fr = 53 THEN trim(split_part(sub.val, '|', 3)) END)             AS dr_mobile_val,
        max(CASE WHEN sub.fr = 53 THEN trim(split_part(sub.val, '|', 4)) END)             AS dr_email_val,
        max(CASE WHEN sub.fr = 52 THEN trim(split_part(sub.val, '|', 3)) END)             AS dr_phone_val,
        max(CASE WHEN sub.fr = 52 THEN trim(split_part(sub.val, '|', 5)) END)             AS dr_fax_val,
        max(CASE WHEN sub.fr IN (48, 49) AND sub.tc = '.....' THEN trim(sub.val) END)     AS postal3_val,
        max(CASE WHEN sub.fr = 47 AND sub.tc = '.....' THEN trim(sub.val) END)            AS postal2_val,
        max(CASE WHEN sub.fr = 46 AND sub.tc = '.....' THEN trim(sub.val) END)            AS postal1_val,
        max(CASE WHEN sub.fr = 31 AND sub.tc = '.....' THEN trim(sub.val) END)            AS notes_text_val,
        max(CASE WHEN sub.fr = 21 AND sub.tc = '.....' THEN trim(sub.val) END)            AS therapy_text_val,
        max(CASE WHEN sub.fr = 12 AND sub.tc = '.....' THEN trim(sub.val) END)            AS diag_cln_text_val,
        max(CASE WHEN sub.fr = 11 AND sub.tc = '.....' THEN trim(sub.val) END)            AS icd10_val,
        max(CASE WHEN sub.fr = 1  AND sub.tc = '.....' THEN trim(sub.val) END)            AS specimen_text_val
    FROM (
        SELECT
            t.labno,
            t.fr,
            trim(t.tc) AS tc,
            CASE
                WHEN octet_length(t.raw) > 16
                THEN disa.fix_string_raw(t.raw, 16, octet_length(t.raw))
                ELSE NULL
            END AS val
        FROM _mig_txt t
    ) sub
    WHERE sub.val IS NOT NULL AND trim(sub.val) != ''
    GROUP BY sub.labno;
    CREATE INDEX ON _mig_txt_pivot(labno);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  → % rows pivoted (% elapsed)', v_count, clock_timestamp() - v_start;

    DROP TABLE _mig_txt;

    -- Test descriptions
    RAISE NOTICE 'Stage 2: Resolving test descriptions...';
    CREATE TEMP TABLE _mig_test_descs ON COMMIT DROP AS
    SELECT
        rf.labno,
        array_agg(td.description ORDER BY t_ord.ordinality) AS descs
    FROM _mig_reg_fields rf
    CROSS JOIN LATERAL unnest(rf.test_codes) WITH ORDINALITY AS t_ord(code, ordinality)
    LEFT JOIN disa.testdict td ON td.code = t_ord.code
    GROUP BY rf.labno;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  → % rows (% elapsed)', v_count, clock_timestamp() - v_start;

    -- =================================================================
    -- Stage 3: Final join — all local, no FDW
    -- =================================================================
    RAISE NOTICE 'Stage 3: Assembling results...';
    RETURN QUERY
    SELECT
        rp.labno,
        rp.inner_lab_no,
        rp.ref_number,
        rp.registered_dt,
        rp.unique_id_val,

        rp.nid_val,
        COALESCE(loc.code, rp.location_code),
        loc.description,
        loc.postal_address1,
        loc.postal_address2,
        loc.postal_address3,
        loc.postal_address4,
        rp.ward_clinic_val,
        rp.folder_no_val,

        nullif(trim(COALESCE(
            nullif(trim(split_part(aud.audit_name, ',', 1)), ''),
            rp.surname
        )), ''),
        nullif(trim(COALESCE(
            nullif(trim(split_part(aud.audit_name, ',', 3)), ''),
            rp.firstname
        )), ''),

        rp.sex_val,
        COALESCE(dob.dob_val, rp.dob_age_val),

        nullif(tx.phone_val, ''),
        nullif(tx.work_val, ''),
        nullif(tx.mobile_val, ''),
        nullif(tx.email_val, ''),
        CASE
            WHEN tx.postal1_val IS NULL AND tx.postal2_val IS NULL AND tx.postal3_val IS NULL THEN NULL
            ELSE concat_ws(E'\r\n',
                COALESCE(tx.postal1_val, ''),
                COALESCE(tx.postal2_val, ''),
                COALESCE(tx.postal3_val, ''))
        END,

        tx.icd10_val,
        rp.therapy_val,
        tx.therapy_text_val,
        rp.notes_val,
        tx.notes_text_val,
        rp.diag_cln_val,
        tx.diag_cln_text_val,

        rp.specimen_val,
        tx.specimen_text_val,
        rp.condition_val,
        COALESCE(tkn.taken_date_val, rp.taken_dt::text),
        nullif(tx.taken_by_val, ''),
        rp.collected_dt,
        nullif(tx.collected_by_val, ''),
        rp.received_in_lab_dt,
        nullif(tx.received_by_val, ''),
        rp.priority_val,

        rp.ref_dr_id_val,
        rp.ref_dr_val,
        nullif(tx.dr_phone_val, ''),
        nullif(tx.dr_fax_val, ''),
        nullif(tx.dr_mobile_val, ''),
        nullif(tx.dr_email_val, ''),

        rp.receipt_val,
        rp.amount_val,
        rp.paid_by_val,

        rp.test_codes,
        tds.descs

    FROM _mig_reg_fields rp
    LEFT JOIN _mig_aud_parsed aud ON aud.labno = rp.labno
    LEFT JOIN _mig_txt_pivot tx   ON tx.labno  = rp.labno
    LEFT JOIN _mig_dob dob        ON dob.labno = rp.labno
    LEFT JOIN _mig_tkn tkn        ON tkn.labno = rp.labno
    LEFT JOIN disa.locndic4 loc   ON loc.code  = rp.location_code
    LEFT JOIN _mig_test_descs tds ON tds.labno = rp.labno;

    RAISE NOTICE 'Done. Total: %', clock_timestamp() - v_start;
END;
$$;
