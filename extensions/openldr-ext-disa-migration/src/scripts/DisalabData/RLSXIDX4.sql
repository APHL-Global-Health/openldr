-- =============================================================================
-- RLSXIDX4: Location + soundex index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RLSXIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rlsxidx4 (
    "LOCATION" text,
    "SOUNDX"   text,
    "REGDATE"  text,
    "LABNO"    text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RLSXIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rlsxidx4 AS
SELECT trim("LOCATION") AS location, trim("SOUNDX") AS soundx, "REGDATE" AS reg_date, trim("LABNO") AS labno
FROM disalab_data.rlsxidx4;
