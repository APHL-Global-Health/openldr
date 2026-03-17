-- =============================================================================
-- RLNKIDX4: Unique ID link index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RLNKIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rlnkidx4 (
    "UNIQUEID" text,
    "REGDATE"  text,
    "LABNO"    text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RLNKIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rlnkidx4 AS
SELECT trim("UNIQUEID") AS unique_id, "REGDATE" AS reg_date, trim("LABNO") AS labno
FROM disalab_data.rlnkidx4;
