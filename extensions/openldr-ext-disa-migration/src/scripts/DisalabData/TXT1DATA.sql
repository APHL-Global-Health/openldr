-- =============================================================================
-- TXT1DATA: Text data records (DisalabData)
-- Mirrors: api/src/lib/DisalabData/TXT1DATA.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.txt1data (
    "DATESTAMP"       text,
    "LABNO"           text,
    "TESTCODE"        text,
    "TESTINDEX"       text,
    "FRAMEREF"        int,
    "TXT1DATA_STATUS" bytea
) SERVER mssql_disalab_data
OPTIONS (table_name 'TXT1DATA', schema_name 'dbo');

-- In JS: PRE = data.substring(0,15), REF = data[15], VALUE = data.substring(16)
CREATE OR REPLACE VIEW disa.v_txt1data AS
SELECT
    "DATESTAMP"                                                       AS datestamp,
    trim("LABNO")                                                     AS labno,
    trim("TESTCODE")                                                  AS testcode,
    "TESTINDEX"                                                       AS testindex,
    "FRAMEREF"                                                        AS frameref,
    disa.fix_string(disa.fix_bytes("TXT1DATA_STATUS"), 0, 15)         AS pre,
    disa.fix_string(disa.fix_bytes("TXT1DATA_STATUS"), 15, 16)        AS ref,
    CASE
        WHEN length(disa.fix_bytes("TXT1DATA_STATUS")) > 16
        THEN disa.fix_string(disa.fix_bytes("TXT1DATA_STATUS"), 16,
             length(disa.fix_bytes("TXT1DATA_STATUS")))
        ELSE NULL
    END                                                               AS value
FROM disalab_data.txt1data;
