-- =============================================================================
-- RSNXIDX4: Soundex index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RSNXIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rsnxidx4 (
    "SOUNDX"  text,
    "REGDATE" text,
    "LABNO"   text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RSNXIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rsnxidx4 AS
SELECT trim("SOUNDX") AS soundx, "REGDATE" AS reg_date, trim("LABNO") AS labno
FROM disalab_data.rsnxidx4;
