-- =============================================================================
-- RLNMIDX4: Location + surname index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RLNMIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rlnmidx4 (
    "LOCATION" text,
    "SURNAME"  text,
    "REGDATE"  text,
    "LABNO"    text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RLNMIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rlnmidx4 AS
SELECT trim("LOCATION") AS location, trim("SURNAME") AS surname, "REGDATE" AS reg_date, trim("LABNO") AS labno
FROM disalab_data.rlnmidx4;
