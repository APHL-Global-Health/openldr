-- =============================================================================
-- ORDRDAT5: Order data (DisalabData)
-- Mirrors: api/src/lib/DisalabData/ORDRDAT5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.ordrdat5 (
    "DATESTAMP"          text,
    "PlacerOrderNo"      text,
    "RefNo"              text,
    "OrderStatus"        text,
    "CollectedDateTime"  text,
    "Labno"              text,
    "Region"             text,
    "HospitalNo"         text,
    "ORDRDat5_STATUS"    bytea
) SERVER mssql_disalab_data
OPTIONS (table_name 'ORDRDAT5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_ordrdat5 AS
SELECT
    "DATESTAMP"                                                              AS datestamp,
    trim("PlacerOrderNo")                                                    AS placer_order_no,
    trim("RefNo")                                                            AS ref_no,
    trim("OrderStatus")                                                      AS order_status,
    "CollectedDateTime"                                                      AS collected_datetime,
    trim("Labno")                                                            AS labno,
    trim("Region")                                                           AS region,
    trim("HospitalNo")                                                       AS hospital_no,
    trim(disa.fix_string(disa.fix_bytes("ORDRDat5_STATUS"), 5, 26))          AS _placer_order_no
FROM disalab_data.ordrdat5;
