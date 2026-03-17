-- =============================================================================
-- BREGDICT: Billing/registration dictionary (DisalabDict)
-- Mirrors: api/src/lib/DisalabDict/BREGDICT.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_dict.bregdict (
    "DATESTAMP"       text,
    "CODE"            text,
    "DESCRIPTION"     text,
    "ABBREV"          text,
    "BREGDICT_STATUS" bytea
) SERVER mssql_disalab_dict
OPTIONS (table_name 'BREGDICT', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_bregdict AS
SELECT
    "DATESTAMP"                                                        AS datestamp,
    trim("CODE")                                                       AS code,
    trim("DESCRIPTION")                                                AS description,
    trim("ABBREV")                                                     AS abbrev,
    trim(disa.fix_string(disa.fix_bytes("BREGDICT_STATUS"), 4, 9))     AS _code,
    trim(disa.fix_string(disa.fix_bytes("BREGDICT_STATUS"), 9, 94))    AS _description
FROM disalab_dict.bregdict;
