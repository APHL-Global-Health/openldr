-- =============================================================================
-- PARMDICT: Parameter/test field dictionary (DisaGlobal)
-- Mirrors: api/src/lib/DisaGlobal/PARMDICT.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disa_global.parmdict (
    "DATESTAMP"       text,
    "CODE"            text,
    "DESCRIPTION"     text,
    "ABBREV"          text,
    "ACTIVE"          text,
    "PARMDICT_STATUS" bytea
) SERVER mssql_disa_global
OPTIONS (table_name 'PARMDICT', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_parmdict AS
SELECT
    "DATESTAMP"                                                          AS datestamp,
    trim("CODE")                                                        AS code,
    trim("DESCRIPTION")                                                 AS description,
    trim("ABBREV")                                                      AS abbreviation,
    "ACTIVE"                                                            AS active,
    ascii(disa.fix_string(disa.fix_bytes("PARMDICT_STATUS"), 121, 122)) AS context,
    ascii(disa.fix_string(disa.fix_bytes("PARMDICT_STATUS"), 0, 1))     AS index,
    trim(disa.fix_string(disa.fix_bytes("PARMDICT_STATUS"), 126, 136))  AS units,
    trim(disa.fix_string(disa.fix_bytes("PARMDICT_STATUS"), 214, 260))  AS reference
FROM disa_global.parmdict;
