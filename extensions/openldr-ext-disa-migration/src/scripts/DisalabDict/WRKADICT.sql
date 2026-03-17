-- =============================================================================
-- WRKADICT: Work area dictionary with location groupings (DisalabDict)
-- Mirrors: api/src/lib/DisalabDict/WRKADICT.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_dict.wrkadict (
    "DATESTAMP"       text,
    "CODE"            text,
    "DESCRIPTION"     text,
    "ABBREV"          text,
    "WRKADICT_STATUS" bytea
) SERVER mssql_disalab_dict
OPTIONS (table_name 'WRKADICT', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_wrkadict AS
SELECT
    "DATESTAMP"                                                          AS datestamp,
    trim("CODE")                                                         AS code,
    trim("DESCRIPTION")                                                  AS description,
    trim("ABBREV")                                                       AS abbrev,
    trim(disa.fix_string(disa.fix_bytes("WRKADICT_STATUS"), 4, 9))       AS _code,
    trim(disa.fix_string(disa.fix_bytes("WRKADICT_STATUS"), 10, 40))     AS _description,
    trim(disa.fix_string(disa.fix_bytes("WRKADICT_STATUS"), 41, 94))     AS _abbreviation
FROM disalab_dict.wrkadict;
