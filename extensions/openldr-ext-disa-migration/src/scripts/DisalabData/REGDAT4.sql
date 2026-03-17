-- =============================================================================
-- REGDAT4: Main registration record (DisalabData)
-- Mirrors: api/src/lib/DisalabData/REGDAT4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.regdat4 (
    "LabNo"          text,
    "REGDAT4_STATUS" bytea
) SERVER mssql_disalab_data
OPTIONS (table_name 'REGDAT4', schema_name 'dbo');

-- View parsing REGDAT4_STATUS binary blob into readable fields
-- Byte offsets match REGDAT4.js Populate() method
CREATE OR REPLACE VIEW disa.v_regdat4 AS
SELECT
    trim("LabNo")                                                             AS lab_number,

    -- System fields
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 5, 8))             AS index,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 32, 41))           AS unique_id,
    disa.datetime_value("REGDAT4_STATUS", 126, 130, 131, 134)                 AS registered_datetime,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 66, 121))          AS reference_number,
    disa.datetime_value("REGDAT4_STATUS", 666, 670, 154, 157)                 AS received_in_lab_datetime,
    disa.datetime_value("REGDAT4_STATUS", 159, 163, 163, 165)                 AS collected_datetime,
    disa.datetime_short_value("REGDAT4_STATUS", 615, 619)                     AS taken_datetime,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 135, 138))         AS received_by,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 139, 142))         AS modified_by,

    -- Patient fields
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 12, 22))           AS inner_lab_number,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 393, 408))         AS nid,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 421, 426))         AS location,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 442, 448))         AS ward_clinic,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 427, 442))         AS folder_number,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 348, 392))         AS name,
    disa.dob_or_age_value("REGDAT4_STATUS", 159, 163, 163, 165)              AS dob_age,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 420, 421))         AS sex,

    -- Parsed name components (split by comma)
    split_part(trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 348, 392)), ',', 1) AS surname,
    split_part(trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 348, 392)), ',', 2) AS middlename,
    split_part(trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 348, 392)), ',', 3) AS firstname,

    -- Specimen Details
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 148, 153))         AS specimen,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 548, 553))         AS condition,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 186, 187))         AS priority,

    -- Clinical Data
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 340, 344))         AS therapy,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 174, 179))         AS notes,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 334, 339))         AS diag_cln,

    -- Referring Doctor
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 507, 511))         AS ref_dr_id,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 513, 548))         AS ref_dr,

    -- Accounts
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 653, 665))         AS receipt,
    disa.to_uint32("REGDAT4_STATUS", 61, 65)                                  AS amount,
    trim(disa.fix_string(disa.fix_bytes("REGDAT4_STATUS"), 482, 507))         AS paid_by

FROM disalab_data.regdat4;

-- Function to extract test order codes from REGDAT4_STATUS
-- In JS: starts at offset 187, reads 7-byte chunks (first 5 = test code), up to 20 tests
CREATE OR REPLACE FUNCTION disa.regdat4_tests(raw bytea)
RETURNS text[]
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    tests text[] := '{}';
    start_idx int := 187;
    test_code text;
    i int;
BEGIN
    IF raw IS NULL THEN RETURN tests; END IF;

    FOR i IN 0..19 LOOP
        EXIT WHEN start_idx + 5 > octet_length(raw);
        -- Use fix_string_raw: decode only 5 bytes per test code, not the full blob
        test_code := trim(disa.fix_string_raw(raw, start_idx, start_idx + 5));
        IF test_code IS NOT NULL AND test_code != '' THEN
            tests := array_append(tests, test_code);
        END IF;
        start_idx := start_idx + 7;
    END LOOP;

    RETURN tests;
END;
$$;
