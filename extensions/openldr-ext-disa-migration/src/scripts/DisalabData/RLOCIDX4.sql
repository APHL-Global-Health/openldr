-- =============================================================================
-- RLOCIDX4: Location + ward index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RLOCIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rlocidx4 (
    "LOCATION" text,
    "WARD"     text,
    "REGDATE"  text,
    "LABNO"    text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RLOCIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rlocidx4 AS
SELECT trim("LOCATION") AS location, trim("WARD") AS ward, "REGDATE" AS reg_date, trim("LABNO") AS labno
FROM disalab_data.rlocidx4;
