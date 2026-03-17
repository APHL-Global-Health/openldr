-- =============================================================================
-- WLSTDAT6: Worklist data (DisalabData)
-- Mirrors: api/src/lib/DisalabData/WLSTDAT6.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.wlstdat6 (
    "DATESTAMP"       text,
    "AREA"            text,
    "WLSTGROUP"       text,
    "WLSTATUS"        text,
    "REQUESTED_DATE"  text,
    "PRIORITY"        text,
    "LABNO"           text,
    "REGION"          text,
    "REQUESTED_Time"  text,
    "TESTINDEX"       text,
    "TESTCODE"        text,
    "REVIEWER"        text,
    "WLSTDAT6_STATUS" bytea
) SERVER mssql_disalab_data
OPTIONS (table_name 'WLSTDAT6', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_wlstdat6 AS
SELECT
    "DATESTAMP"                                                           AS datestamp,
    trim("AREA")                                                          AS area,
    trim("WLSTGROUP")                                                     AS wlstgroup,
    trim("WLSTATUS")                                                      AS wlstatus,
    "REQUESTED_DATE"                                                      AS requested_date,
    trim("PRIORITY")                                                      AS priority,
    trim("LABNO")                                                         AS labno,
    trim("REGION")                                                        AS region,
    "REQUESTED_Time"                                                      AS requested_time,
    trim("TESTINDEX")                                                     AS testindex,
    trim("TESTCODE")                                                      AS testcode,
    trim("REVIEWER")                                                      AS reviewer,
    trim(disa.fix_string(disa.fix_bytes("WLSTDAT6_STATUS"), 4, 9))        AS _area,
    trim(disa.fix_string(disa.fix_bytes("WLSTDAT6_STATUS"), 9, 10))       AS _wlstgroup,
    trim(disa.fix_string(disa.fix_bytes("WLSTDAT6_STATUS"), 20, 25))      AS _testcode,
    trim(disa.fix_string(disa.fix_bytes("WLSTDAT6_STATUS"), 31, 36))      AS _reviewer,
    trim(disa.fix_string(disa.fix_bytes("WLSTDAT6_STATUS"), 36, 41))      AS _reviewer2,
    trim(disa.fix_string(disa.fix_bytes("WLSTDAT6_STATUS"), 122, 127))    AS _storage,
    trim(disa.fix_string(disa.fix_bytes("WLSTDAT6_STATUS"), 131, 132))    AS _route
FROM disalab_data.wlstdat6;
