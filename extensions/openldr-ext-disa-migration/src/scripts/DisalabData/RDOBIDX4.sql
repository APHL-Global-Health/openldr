-- =============================================================================
-- RDOBIDX4: Date of birth index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RDOBIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rdobidx4 (
    "DOBDATE" text,
    "LABNO"   text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RDOBIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rdobidx4 AS
SELECT "DOBDATE" AS dob_date, trim("LABNO") AS labno FROM disalab_data.rdobidx4;
