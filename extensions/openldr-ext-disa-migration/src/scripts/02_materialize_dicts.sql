-- =============================================================================
-- Materialize dictionary tables locally for performance
-- =============================================================================
-- DisaGlobal and DisalabDict tables rarely change. Querying them over FDW
-- on every request adds ~1-2s per round-trip. Instead, we copy them into
-- local tables and refresh on demand.
--
-- Usage:
--   SELECT disa.refresh_dictionaries();   -- re-sync all from MSSQL
--   SELECT disa.refresh_dictionary('parmdict');  -- re-sync one table
-- =============================================================================

-- ===================== DisaGlobal local tables =====================

CREATE TABLE IF NOT EXISTS disa.parmdict (
    datestamp    text,
    code         text,
    description  text,
    abbreviation text,
    active       text,
    context      int,
    index        int,
    units        text,
    reference    text
);

CREATE TABLE IF NOT EXISTS disa.commdict (
    context      int,
    code         text,
    description  text,
    active       text
);

CREATE TABLE IF NOT EXISTS disa.testdict (
    datestamp     text,
    code          text,
    description   text,
    abbrev        text,
    section       text,
    _code         text,
    _description  text,
    _abbreviation text,
    _workarea_group text
);

CREATE TABLE IF NOT EXISTS disa.locndic4 (
    datestamp             text,
    code                  text,
    description           text,
    abbrev                text,
    telephone             text,
    name                  text,
    postal_address1       text,
    postal_address2       text,
    postal_address3       text,
    postal_address4       text,
    post_code             text,
    organisation          text,
    active                text,
    district              text,
    facility_type         text,
    facility_arrangement  text
);

CREATE TABLE IF NOT EXISTS disa.systdic5 (
    datestamp        text,
    id               int,
    laboratory_name  text
);

-- ===================== DisalabDict local tables =====================

CREATE TABLE IF NOT EXISTS disa.desldic5 (
    datestamp      text,
    language       text,
    context        text,
    code1          text,
    code2          text,
    code3          text,
    description    text,
    abbrev         text,
    _context       text,
    _code1         text,
    _code2         text,
    _code3         text,
    _description   text,
    _abbreviation  text
);

CREATE TABLE IF NOT EXISTS disa.ruledic5 (
    datestamp  text,
    code      text
);

CREATE TABLE IF NOT EXISTS disa.bregdict (
    datestamp      text,
    code           text,
    description    text,
    abbrev         text,
    _code          text,
    _description   text
);

CREATE TABLE IF NOT EXISTS disa.ordrdic5 (
    datestamp          text,
    code               text,
    locncode           text,
    usage              text,
    _createdby         text,
    _code              text,
    _usage             text,
    _section           text,
    _area              text,
    _group             text,
    _storage           text,
    _route             text,
    _labs_allowed      text,
    _rules_on_order    text,
    _rules_on_result   text,
    _rules_on_review   text
);

CREATE TABLE IF NOT EXISTS disa.wrkadict (
    datestamp       text,
    code            text,
    description     text,
    abbrev          text,
    _code           text,
    _description    text,
    _abbreviation   text
);

CREATE TABLE IF NOT EXISTS disa.doccdat5 (
    datestamp   text,
    context    text,
    code1      text,
    code2      text,
    code3      text,
    code4      text,
    _context   text,
    _code1     text,
    _code2     text,
    _code3     text,
    _code4     text
);

-- ===================== Indexes for fast lookups =====================

CREATE INDEX IF NOT EXISTS idx_parmdict_code ON disa.parmdict(code);
CREATE INDEX IF NOT EXISTS idx_commdict_context_code ON disa.commdict(context, code);
CREATE INDEX IF NOT EXISTS idx_testdict_code ON disa.testdict(code);
CREATE INDEX IF NOT EXISTS idx_locndic4_code ON disa.locndic4(code);

-- ===================== Refresh functions =====================

CREATE OR REPLACE FUNCTION disa.refresh_dictionary(table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    CASE table_name
        WHEN 'parmdict' THEN
            TRUNCATE disa.parmdict;
            INSERT INTO disa.parmdict SELECT * FROM disa.v_parmdict;
        WHEN 'commdict' THEN
            TRUNCATE disa.commdict;
            INSERT INTO disa.commdict SELECT * FROM disa.v_commdict;
        WHEN 'testdict' THEN
            TRUNCATE disa.testdict;
            INSERT INTO disa.testdict SELECT * FROM disa.v_testdict;
        WHEN 'locndic4' THEN
            TRUNCATE disa.locndic4;
            INSERT INTO disa.locndic4 SELECT * FROM disa.v_locndic4;
        WHEN 'systdic5' THEN
            TRUNCATE disa.systdic5;
            INSERT INTO disa.systdic5 SELECT * FROM disa.v_systdic5;
        WHEN 'desldic5' THEN
            TRUNCATE disa.desldic5;
            INSERT INTO disa.desldic5 SELECT * FROM disa.v_desldic5;
        WHEN 'ruledic5' THEN
            TRUNCATE disa.ruledic5;
            INSERT INTO disa.ruledic5 SELECT * FROM disa.v_ruledic5;
        WHEN 'bregdict' THEN
            TRUNCATE disa.bregdict;
            INSERT INTO disa.bregdict SELECT * FROM disa.v_bregdict;
        WHEN 'ordrdic5' THEN
            TRUNCATE disa.ordrdic5;
            INSERT INTO disa.ordrdic5 SELECT * FROM disa.v_ordrdic5;
        WHEN 'wrkadict' THEN
            TRUNCATE disa.wrkadict;
            INSERT INTO disa.wrkadict SELECT * FROM disa.v_wrkadict;
        WHEN 'doccdat5' THEN
            TRUNCATE disa.doccdat5;
            INSERT INTO disa.doccdat5 SELECT * FROM disa.v_doccdat5;
        ELSE
            RAISE EXCEPTION 'Unknown dictionary table: %', table_name;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION disa.refresh_dictionaries()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'Refreshing DisaGlobal dictionaries...';
    PERFORM disa.refresh_dictionary('parmdict');
    PERFORM disa.refresh_dictionary('commdict');
    PERFORM disa.refresh_dictionary('testdict');
    PERFORM disa.refresh_dictionary('locndic4');
    PERFORM disa.refresh_dictionary('systdic5');

    RAISE NOTICE 'Refreshing DisalabDict dictionaries...';
    PERFORM disa.refresh_dictionary('desldic5');
    PERFORM disa.refresh_dictionary('ruledic5');
    PERFORM disa.refresh_dictionary('bregdict');
    PERFORM disa.refresh_dictionary('ordrdic5');
    PERFORM disa.refresh_dictionary('wrkadict');
    PERFORM disa.refresh_dictionary('doccdat5');

    RAISE NOTICE 'All dictionaries refreshed.';
END;
$$;

-- ===================== Initial load =====================
-- Populate local tables on first init
SELECT disa.refresh_dictionaries();
