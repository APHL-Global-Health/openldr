-- =============================================================================
-- RDOCIDX4: Doctor index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RDOCIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rdocidx4 (
    "DOCTOR"  text,
    "REGDATE" text,
    "LABNO"   text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RDOCIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rdocidx4 AS
SELECT trim("DOCTOR") AS doctor, "REGDATE" AS reg_date, trim("LABNO") AS labno
FROM disalab_data.rdocidx4;
