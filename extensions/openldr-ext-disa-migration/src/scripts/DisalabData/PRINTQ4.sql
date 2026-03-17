-- =============================================================================
-- PRINTQ4: Print queue (DisalabData)
-- Mirrors: api/src/lib/DisalabData/PRINTQ4.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.printq4 (
    "DATESTAMP"       text,
    "QUEUE"           text,
    "ROUTE"           text,
    "LOCATION"        text,
    "WARD"            text,
    "DRCODE"          text,
    "LABNO"           text,
    "XPRINTSET"       text,
    "LANGUAGE"        text,
    "REPTYPE"         text,
    "COPY_NO"         text,
    "PRINTQ4_STATUS"  bytea
) SERVER mssql_disalab_data
OPTIONS (table_name 'PRINTQ4', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_printq4 AS
SELECT
    "DATESTAMP"                                                          AS datestamp,
    trim("QUEUE")                                                        AS queue,
    trim("ROUTE")                                                        AS route,
    trim("LOCATION")                                                     AS location,
    trim("WARD")                                                         AS ward,
    trim("DRCODE")                                                       AS drcode,
    trim("LABNO")                                                        AS labno,
    trim("XPRINTSET")                                                    AS xprintset,
    trim("LANGUAGE")                                                     AS language,
    trim("REPTYPE")                                                      AS reptype,
    trim("COPY_NO")                                                      AS copy_no,
    trim(disa.fix_string(disa.fix_bytes("PRINTQ4_STATUS"), 5, 6))        AS _route,
    trim(disa.fix_string(disa.fix_bytes("PRINTQ4_STATUS"), 6, 11))       AS _location,
    trim(disa.fix_string(disa.fix_bytes("PRINTQ4_STATUS"), 11, 16))      AS _ward,
    trim(disa.fix_string(disa.fix_bytes("PRINTQ4_STATUS"), 27, 28))      AS _language,
    trim(disa.fix_string(disa.fix_bytes("PRINTQ4_STATUS"), 28, 29))      AS _reptype
FROM disalab_data.printq4;
