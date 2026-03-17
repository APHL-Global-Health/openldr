-- =============================================================================
-- LOCNDIC4: Location/facility dictionary (DisaGlobal)
-- Mirrors: api/src/lib/DisaGlobal/LOCNDIC4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disa_global.locndic4 (
    "DATESTAMP"            text,
    "CODE"                 text,
    "DESCRIPTION"          text,
    "ABBREV"               text,
    "TELEPHONE"            text,
    "NAME"                 text,
    "POSTAL_ADDRESS1"      text,
    "POSTAL_ADDRESS2"      text,
    "POSTAL_ADDRESS3"      text,
    "POSTAL_ADDRESS4"      text,
    "POST_CODE"            text,
    "ORGANISATION"         text,
    "ACTIVE"               text,
    "District"             text,
    "FacilityType"         text,
    "FacilityArrangement"  text,
    "LOCNDIC4_STATUS"      bytea
) SERVER mssql_disa_global
OPTIONS (table_name 'LOCNDIC4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_locndic4 AS
SELECT
    "DATESTAMP"             AS datestamp,
    trim("CODE")            AS code,
    trim("DESCRIPTION")     AS description,
    trim("ABBREV")          AS abbrev,
    trim("TELEPHONE")       AS telephone,
    trim("NAME")            AS name,
    trim("POSTAL_ADDRESS1") AS postal_address1,
    trim("POSTAL_ADDRESS2") AS postal_address2,
    trim("POSTAL_ADDRESS3") AS postal_address3,
    trim("POSTAL_ADDRESS4") AS postal_address4,
    trim("POST_CODE")       AS post_code,
    trim("ORGANISATION")    AS organisation,
    "ACTIVE"                AS active,
    trim("District")        AS district,
    trim("FacilityType")    AS facility_type,
    trim("FacilityArrangement") AS facility_arrangement
FROM disa_global.locndic4;
