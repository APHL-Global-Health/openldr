-- =============================================================================
-- DESLDIC5: Description/section dictionary with language support (DisalabDict)
-- Mirrors: api/src/lib/DisalabDict/DESLDIC5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_dict.desldic5 (
    "DATESTAMP"       text,
    "LANGUAGE"        text,
    "CONTEXT"         text,
    "CODE1"           text,
    "CODE2"           text,
    "CODE3"           text,
    "DESCRIPTION"     text,
    "ABBREV"          text,
    "DESLDIC5_STATUS" bytea
) SERVER mssql_disalab_dict
OPTIONS (table_name 'DESLDIC5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_desldic5 AS
SELECT
    "DATESTAMP"                                                           AS datestamp,
    trim("LANGUAGE")                                                      AS language,
    trim("CONTEXT")                                                       AS context,
    trim("CODE1")                                                         AS code1,
    trim("CODE2")                                                         AS code2,
    trim("CODE3")                                                         AS code3,
    trim("DESCRIPTION")                                                   AS description,
    trim("ABBREV")                                                        AS abbrev,
    trim(disa.fix_string(disa.fix_bytes("DESLDIC5_STATUS"), 16, 21))      AS _context,
    trim(disa.fix_string(disa.fix_bytes("DESLDIC5_STATUS"), 21, 26))      AS _code1,
    trim(disa.fix_string(disa.fix_bytes("DESLDIC5_STATUS"), 26, 31))      AS _code2,
    trim(disa.fix_string(disa.fix_bytes("DESLDIC5_STATUS"), 31, 36))      AS _code3,
    trim(disa.fix_string(disa.fix_bytes("DESLDIC5_STATUS"), 37, 68))      AS _description,
    trim(disa.fix_string(disa.fix_bytes("DESLDIC5_STATUS"), 68, 138))     AS _abbreviation
FROM disalab_dict.desldic5;
