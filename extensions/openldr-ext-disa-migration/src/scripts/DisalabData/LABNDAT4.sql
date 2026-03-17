-- =============================================================================
-- LABNDAT4: Lab number data (DisalabData)
-- Mirrors: api/src/lib/DisalabData/LABNDAT4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.labndat4 (
    "DATESTAMP" text,
    "ID"        text,
    "LABDATE"   text,
    "LABNO"     text
) SERVER mssql_disalab_data
OPTIONS (table_name 'LABNDAT4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_labndat4 AS
SELECT "DATESTAMP" AS datestamp, "ID" AS id, "LABDATE" AS lab_date, trim("LABNO") AS labno
FROM disalab_data.labndat4;
