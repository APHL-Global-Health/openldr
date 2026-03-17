-- =============================================================================
-- RIDNIDX4: ID number index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RIDNIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.ridnidx4 (
    "IDNUMBER" text,
    "LABNO"    text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RIDNIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_ridnidx4 AS
SELECT trim("IDNUMBER") AS id_number, trim("LABNO") AS labno FROM disalab_data.ridnidx4;
