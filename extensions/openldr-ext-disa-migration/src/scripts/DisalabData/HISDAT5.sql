-- =============================================================================
-- HISDAT5: Patient history data (DisalabData)
-- Mirrors: api/src/lib/DisalabData/HISDAT5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.hisdat5 (
    "DATESTAMP"      text,
    "Location"       text,
    "HospitalNo"     text,
    "IDNo"           text,
    "HISDat5_STATUS" bytea
) SERVER mssql_disalab_data
OPTIONS (table_name 'HISDAT5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_hisdat5 AS
SELECT
    "DATESTAMP"                                                          AS datestamp,
    trim("Location")                                                     AS location,
    trim("HospitalNo")                                                   AS hospital_no,
    trim("IDNo")                                                         AS id_no,
    trim(disa.fix_string(disa.fix_bytes("HISDat5_STATUS"), 5, 20))       AS _patient_id,
    trim(disa.fix_string(disa.fix_bytes("HISDat5_STATUS"), 21, 53))      AS _name,
    -- Parsed name components (split by comma: surname, middle, given)
    split_part(trim(disa.fix_string(disa.fix_bytes("HISDat5_STATUS"), 21, 53)), ',', 1) AS _family_last_name,
    split_part(trim(disa.fix_string(disa.fix_bytes("HISDat5_STATUS"), 21, 53)), ',', 2) AS _middle_name,
    split_part(trim(disa.fix_string(disa.fix_bytes("HISDat5_STATUS"), 21, 53)), ',', 3) AS _given_name,
    trim(disa.fix_string(disa.fix_bytes("HISDat5_STATUS"), 89, 90))      AS sex,
    trim(disa.fix_string(disa.fix_bytes("HISDat5_STATUS"), 122, 723))    AS address,
    trim(disa.fix_string(disa.fix_bytes("HISDat5_STATUS"), 814, 854))    AS phone_number_business,
    trim(disa.fix_string(disa.fix_bytes("HISDat5_STATUS"), 854, 894))    AS phone_number_home
FROM disalab_data.hisdat5;
