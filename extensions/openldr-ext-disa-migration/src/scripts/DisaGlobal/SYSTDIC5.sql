-- =============================================================================
-- SYSTDIC5: System configuration dictionary (DisaGlobal)
-- Mirrors: api/src/lib/DisaGlobal/SYSTDIC5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disa_global.systdic5 (
    "DATESTAMP"       text,
    "ID"              int,
    "LABORATORY_NAME" text,
    "SYSTDIC5_STATUS" bytea
) SERVER mssql_disa_global
OPTIONS (table_name 'SYSTDIC5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_systdic5 AS
SELECT
    "DATESTAMP"                AS datestamp,
    "ID"                       AS id,
    trim("LABORATORY_NAME")    AS laboratory_name
FROM disa_global.systdic5;

-- Function to extract lab number prefixes from SYSTDIC5_STATUS (when ID=64)
-- In JS: reads from offset 5, then 4-byte increments until empty
CREATE OR REPLACE FUNCTION disa.systdic5_prefixes(raw bytea, rec_id int)
RETURNS text[]
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    data text;
    prefixes text[] := '{}';
    start_idx int := 5;
    prefix text;
BEGIN
    IF raw IS NULL OR rec_id != 64 THEN RETURN prefixes; END IF;
    data := disa.fix_bytes(raw);

    LOOP
        EXIT WHEN start_idx + 4 > length(data);
        prefix := trim(substring(data FROM start_idx + 1 FOR 4));
        EXIT WHEN prefix = '';
        prefixes := array_append(prefixes, prefix);
        start_idx := start_idx + 4;
    END LOOP;

    RETURN prefixes;
END;
$$;
