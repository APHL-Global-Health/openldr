-- =============================================================================
-- TESTDICT: Test definitions with parameters (DisaGlobal)
-- Mirrors: api/src/lib/DisaGlobal/TESTDICT.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disa_global.testdict (
    "DATESTAMP"       text,
    "CODE"            text,
    "DESCRIPTION"     text,
    "ABBREV"          text,
    "SECTION"         text,
    "TESTDICT_STATUS" bytea
) SERVER mssql_disa_global
OPTIONS (table_name 'TESTDICT', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_testdict AS
SELECT
    "DATESTAMP"                                                           AS datestamp,
    trim("CODE")                                                         AS code,
    trim("DESCRIPTION")                                                  AS description,
    trim("ABBREV")                                                       AS abbrev,
    trim("SECTION")                                                      AS section,
    trim(disa.fix_string(disa.fix_bytes("TESTDICT_STATUS"), 4, 9))       AS _code,
    trim(disa.fix_string(disa.fix_bytes("TESTDICT_STATUS"), 10, 40))     AS _description,
    trim(disa.fix_string(disa.fix_bytes("TESTDICT_STATUS"), 41, 98))     AS _abbreviation,
    trim(disa.fix_string(disa.fix_bytes("TESTDICT_STATUS"), 104, 105))   AS _workarea_group
FROM disa_global.testdict;

-- Function to extract PARAMETERS array from TESTDICT_STATUS bytes
-- In JS, parameters are read starting at offset 205 in 30-byte chunks
CREATE OR REPLACE FUNCTION disa.testdict_parameters(raw bytea)
RETURNS text[]
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    data text;
    params text[] := '{}';
    start_idx int := 205;
    param text;
BEGIN
    IF raw IS NULL THEN RETURN params; END IF;
    data := disa.fix_bytes(raw);

    LOOP
        EXIT WHEN start_idx + 30 > length(data);
        param := trim(substring(data FROM start_idx + 1 FOR 30));
        EXIT WHEN param = '';
        params := array_append(params, param);
        start_idx := start_idx + 30;
    END LOOP;

    RETURN params;
END;
$$;
