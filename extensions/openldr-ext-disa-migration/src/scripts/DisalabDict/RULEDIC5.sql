-- =============================================================================
-- RULEDIC5: Rule definitions and logic flow (DisalabDict)
-- Mirrors: api/src/lib/DisalabDict/RULEDIC5.js
-- =============================================================================

CREATE FOREIGN TABLE IF NOT EXISTS disalab_dict.ruledic5 (
    "DATESTAMP"       text,
    "CODE"            text,
    "RULEDIC5_STATUS" bytea
) SERVER mssql_disalab_dict
OPTIONS (table_name 'RULEDIC5', schema_name 'dbo');

CREATE OR REPLACE VIEW disa.v_ruledic5 AS
SELECT
    "DATESTAMP"  AS datestamp,
    trim("CODE") AS code
FROM disalab_dict.ruledic5;

-- Function to extract rules array from RULEDIC5_STATUS
-- In JS: starts at offset 20, reads 32-byte chunks (command:1, unknown:1, rule:30)
-- Up to 61 entries, stops at command "X"
CREATE OR REPLACE FUNCTION disa.ruledic5_rules(raw bytea)
RETURNS TABLE(command text, unknown text, rule text)
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    data text;
    start_idx int := 20;
    cmd text;
    unk text;
    rul text;
    i int;
BEGIN
    IF raw IS NULL THEN RETURN; END IF;
    data := disa.fix_bytes(raw);

    FOR i IN 0..60 LOOP
        EXIT WHEN start_idx + 32 > length(data);

        cmd := substring(data FROM start_idx + 1 FOR 1);
        unk := substring(data FROM start_idx + 2 FOR 1);
        rul := trim(substring(data FROM start_idx + 3 FOR 30));

        EXIT WHEN cmd = '' OR cmd IS NULL;

        command := cmd;
        unknown := unk;
        rule := rul;
        RETURN NEXT;

        EXIT WHEN cmd = 'X';

        start_idx := start_idx + 32;
    END LOOP;
END;
$$;
