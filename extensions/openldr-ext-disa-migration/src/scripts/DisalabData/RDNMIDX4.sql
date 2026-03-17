-- =============================================================================
-- RDNMIDX4: Doctor name index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RDNMIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rdnmidx4 (
    "DOCTOR"  text,
    "SURNAME" text,
    "REGDATE" text,
    "LABNO"   text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RDNMIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rdnmidx4 AS
SELECT trim("DOCTOR") AS doctor, trim("SURNAME") AS surname, "REGDATE" AS reg_date, trim("LABNO") AS labno
FROM disalab_data.rdnmidx4;
