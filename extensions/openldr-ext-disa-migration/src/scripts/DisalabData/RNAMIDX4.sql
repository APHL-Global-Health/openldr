-- =============================================================================
-- RNAMIDX4: Patient surname index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RNAMIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rnamidx4 (
    "SURNAME" text,
    "REGDATE" text,
    "LABNO"   text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RNAMIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rnamidx4 AS
SELECT trim("SURNAME") AS surname, "REGDATE" AS reg_date, trim("LABNO") AS labno
FROM disalab_data.rnamidx4;
