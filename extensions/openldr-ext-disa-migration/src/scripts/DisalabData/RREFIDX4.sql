-- =============================================================================
-- RREFIDX4: Reference number index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RREFIDX4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rrefidx4 (
    "REFNO" text,
    "LABNO" text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RREFIDX4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rrefidx4 AS
SELECT trim("REFNO") AS ref_no, trim("LABNO") AS labno FROM disalab_data.rrefidx4;
