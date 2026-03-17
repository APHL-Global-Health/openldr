-- =============================================================================
-- STOADAT5: Storage data (DisalabData)
-- Mirrors: api/src/lib/DisalabData/STOADAT5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.stoadat5 (
    "DATESTAMP"       text,
    "CODE"            text,
    "UPDATEDDATE"     text,
    "SEQNO"           text,
    "SPECTYPE"        text,
    "LABNO"           text,
    "REGION"          text,
    "STOADAT5_STATUS" bytea
) SERVER mssql_disalab_data
OPTIONS (table_name 'STOADAT5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_stoadat5 AS
SELECT
    "DATESTAMP"                                                          AS datestamp,
    trim("CODE")                                                         AS code,
    "UPDATEDDATE"                                                        AS updated_date,
    "SEQNO"                                                              AS seqno,
    trim("SPECTYPE")                                                     AS spectype,
    trim("LABNO")                                                        AS labno,
    trim("REGION")                                                       AS region,
    trim(disa.fix_string(disa.fix_bytes("STOADAT5_STATUS"), 15, 20))     AS _code
FROM disalab_data.stoadat5;
