-- =============================================================================
-- AUDTDATA: Audit trail data (DisalabData)
-- Mirrors: api/src/lib/DisalabData/AUDTDATA.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.audtdata (
    "DATESTAMP"       text,
    "LABNO"           text,
    "AUDDateTime"     text,
    "OCCURS"          text,
    "WS"              text,
    "AUDTDATA_STATUS" bytea
) SERVER mssql_disalab_data
OPTIONS (table_name 'AUDTDATA', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_audtdata AS
SELECT
    "DATESTAMP"                                                          AS datestamp,
    trim("LABNO")                                                        AS labno,
    "AUDDateTime"                                                        AS aud_datetime,
    "OCCURS"                                                             AS occurs,
    "WS"                                                                 AS ws,
    trim(disa.fix_string(disa.fix_bytes("AUDTDATA_STATUS"), 19, 24))     AS _audit_code,
    trim(disa.fix_string(disa.fix_bytes("AUDTDATA_STATUS"), 24, 29))     AS _audit_user,
    trim(disa.fix_string(disa.fix_bytes("AUDTDATA_STATUS"), 36, 66))     AS _audit_data
FROM disalab_data.audtdata;
