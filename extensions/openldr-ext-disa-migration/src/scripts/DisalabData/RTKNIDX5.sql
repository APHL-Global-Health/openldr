-- =============================================================================
-- RTKNIDX5: Taken date index (DisalabData)
-- Mirrors: api/src/lib/DisalabData/RTKNIDX5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.rtknidx5 (
    "TAKENDATE"  text,
    "INVOICENO"  text
) SERVER mssql_disalab_data
OPTIONS (table_name 'RTKNIDX5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_rtknidx5 AS
SELECT "TAKENDATE" AS taken_date, trim("INVOICENO") AS invoiceno FROM disalab_data.rtknidx5;
