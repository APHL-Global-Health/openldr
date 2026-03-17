-- =============================================================================
-- LOCKDAT5: Lock data (DisalabData)
-- Mirrors: api/src/lib/DisalabData/LOCKDAT5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.lockdat5 (
    "DATESTAMP"      text,
    "LOCKKEY"        text,
    "WorkstationID"  text
) SERVER mssql_disalab_data
OPTIONS (table_name 'LOCKDAT5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_lockdat5 AS
SELECT "DATESTAMP" AS datestamp, trim("LOCKKEY") AS lock_key, trim("WorkstationID") AS workstation_id
FROM disalab_data.lockdat5;
