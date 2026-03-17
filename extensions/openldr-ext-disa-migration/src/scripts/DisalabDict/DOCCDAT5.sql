-- =============================================================================
-- DOCCDAT5: Document classification dictionary (DisalabDict)
-- Mirrors: api/src/lib/DisalabDict/DOCCDAT5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_dict.doccdat5 (
    "DATESTAMP"       text,
    "CONTEXT"         text,
    "CODE1"           text,
    "CODE2"           text,
    "CODE3"           text,
    "CODE4"           text,
    "DOCCDAT5_STATUS" bytea
) SERVER mssql_disalab_dict
OPTIONS (table_name 'DOCCDAT5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_doccdat5 AS
SELECT
    "DATESTAMP"                                                          AS datestamp,
    trim("CONTEXT")                                                      AS context,
    trim("CODE1")                                                        AS code1,
    trim("CODE2")                                                        AS code2,
    trim("CODE3")                                                        AS code3,
    trim("CODE4")                                                        AS code4,
    trim(disa.fix_string(disa.fix_bytes("DOCCDAT5_STATUS"), 15, 20))     AS _context,
    trim(disa.fix_string(disa.fix_bytes("DOCCDAT5_STATUS"), 20, 25))     AS _code1,
    trim(disa.fix_string(disa.fix_bytes("DOCCDAT5_STATUS"), 25, 30))     AS _code2,
    trim(disa.fix_string(disa.fix_bytes("DOCCDAT5_STATUS"), 30, 35))     AS _code3,
    trim(disa.fix_string(disa.fix_bytes("DOCCDAT5_STATUS"), 35, 40))     AS _code4
FROM disalab_dict.doccdat5;
