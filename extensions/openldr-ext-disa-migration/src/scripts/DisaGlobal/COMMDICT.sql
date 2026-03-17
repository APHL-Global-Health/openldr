-- =============================================================================
-- COMMDICT: Common code values dictionary (DisaGlobal)
-- Mirrors: api/src/lib/DisaGlobal/COMMDICT.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disa_global.commdict (
    "CONTEXT"         int,
    "CODE"            text,
    "DESCRIPTION"     text,
    "ACTIVE"          text,
    "COMMDICT_STATUS" bytea
) SERVER mssql_disa_global
OPTIONS (table_name 'COMMDICT', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_commdict AS
SELECT
    "CONTEXT"            AS context,
    trim("CODE")         AS code,
    trim("DESCRIPTION")  AS description,
    "ACTIVE"             AS active
FROM disa_global.commdict;
