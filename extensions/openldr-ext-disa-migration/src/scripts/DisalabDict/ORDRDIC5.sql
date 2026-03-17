-- =============================================================================
-- ORDRDIC5: Order dictionary with storage and routing info (DisalabDict)
-- Mirrors: api/src/lib/DisalabDict/ORDRDIC5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_dict.ordrdic5 (
    "DATESTAMP"       text,
    "CODE"            text,
    "LOCNCODE"        text,
    "USAGE"           text,
    "ORDRDIC5_STATUS" bytea
) SERVER mssql_disalab_dict
OPTIONS (table_name 'ORDRDIC5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_ordrdic5 AS
SELECT
    "DATESTAMP"                                                            AS datestamp,
    trim("CODE")                                                           AS code,
    trim("LOCNCODE")                                                       AS locncode,
    trim("USAGE")                                                          AS usage,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 4, 9))         AS _createdby,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 15, 20))       AS _code,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 25, 26))       AS _usage,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 38, 43))       AS _section,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 43, 48))       AS _area,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 48, 49))       AS _group,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 58, 63))       AS _storage,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 63, 64))       AS _route,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 907, 967))     AS _labs_allowed,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 967, 972))     AS _rules_on_order,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 977, 982))     AS _rules_on_result,
    trim(disa.fix_string(disa.fix_bytes("ORDRDIC5_STATUS"), 982, 988))     AS _rules_on_review
FROM disalab_dict.ordrdic5;
