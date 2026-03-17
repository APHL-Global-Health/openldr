-- =============================================================================
-- RLIDIDX4: Location + patient ID index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RLIDIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rlididx4 (
    "LOCATION" text,
    "PID"      text,
    "REGDATE"  text,
    "LABNO"    text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RLIDIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rlididx4 AS
SELECT trim("LOCATION") AS location, trim("PID") AS pid, "REGDATE" AS reg_date, trim("LABNO") AS labno
FROM disalab_data.rlididx4;
