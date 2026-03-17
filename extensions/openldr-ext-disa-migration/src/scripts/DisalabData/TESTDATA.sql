-- =============================================================================
-- TESTDATA: Test results (DisalabData)
-- Mirrors: api/src/lib/DisalabData/TESTDATA.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_data.testdata (
    "DATESTAMP"       text,
    "LABNO"           text,
    "TESTCODE"        text,
    "TESTINDEX"       text,
    "TESTDATA_STATUS" bytea
) SERVER mssql_disalab_data
OPTIONS (table_name 'TESTDATA', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_testdata AS
SELECT
    "DATESTAMP"    AS datestamp,
    trim("LABNO")     AS labno,
    trim("TESTCODE")  AS testcode,
    "TESTINDEX"    AS testindex
FROM disalab_data.testdata;

-- Function to extract order items from TESTDATA_STATUS
-- In JS (OrderItem.Parse): starts at offset 80 of the converted data, reads 12-byte chunks
-- Each chunk: par(5 bytes) + type(1 byte) + resulted(1 byte) + result(5 bytes)
-- Up to 50 items, stops if startIndex+12 > data.length
CREATE OR REPLACE FUNCTION disa.testdata_order_items(raw bytea)
RETURNS TABLE(
    parameter_code text,
    result_type int,
    result_value text,
    result_float double precision
)
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    data text;
    start_idx int := 80;
    par text;
    rtype int;
    rval text;
    i int;
BEGIN
    IF raw IS NULL THEN RETURN; END IF;
    data := disa.convert_to_bytes(raw);
    -- OrderItem.Parse uses Core.FixString(data, 80, data.length) then processes from 0
    -- We'll work from offset 80 directly

    FOR i IN 1..50 LOOP
        EXIT WHEN start_idx + 12 > length(data);

        par := replace(substring(data FROM start_idx + 1 FOR 5), chr(0), ' ');
        EXIT WHEN trim(par) = '';

        rtype := ascii(substring(data FROM start_idx + 6 FOR 1));
        rval  := substring(data FROM start_idx + 8 FOR 5);

        parameter_code := trim(par);
        result_type    := rtype;

        -- For numeric types (1=Real/Integer, 2=Accounting), convert to float
        IF rtype IN (1, 2) AND rval IS NOT NULL AND trim(replace(rval, chr(0), '')) != '' THEN
            result_float := disa.to_float32(raw, start_idx + 7, start_idx + 11);
            result_value := result_float::text;
        ELSE
            result_value := trim(replace(rval, chr(0), ' '));
            result_float := NULL;
        END IF;

        RETURN NEXT;

        start_idx := start_idx + 12;
    END LOOP;
END;
$$;
