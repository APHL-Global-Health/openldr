-- =============================================================================
-- Core Functions: PL/pgSQL equivalents of api/src/lib/core.js and bitconverter.js
-- =============================================================================
-- All functions live in the `disa` schema.
-- These operate on bytea data from MSSQL IMAGE/_STATUS columns.
--
-- JS uses 0-based indexing; PG uses 1-based. The functions below accept
-- 0-based offsets (matching the JS source) and convert internally.
--
-- IMPORTANT: PostgreSQL text type cannot hold null bytes (\x00).
-- We replace \x00 → \x20 (space) in bytea before convert_from for text functions,
-- and use get_byte() directly on bytea for numeric byte-value functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: replace null bytes in bytea with space bytes
-- Uses C extension (openldr_utils.so) for speed — critical at 45M+ rows.
-- Falls back to PL/pgSQL if C extension not available.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    -- Try to create C version first (installed via Dockerfile)
    BEGIN
        EXECUTE $fn$
            CREATE OR REPLACE FUNCTION disa._replace_null_bytes(raw bytea)
            RETURNS bytea
            AS '$libdir/openldr_utils', 'bytea_replace_null'
            LANGUAGE C IMMUTABLE STRICT
        $fn$;
        RAISE NOTICE 'disa._replace_null_bytes: using C extension (fast)';
    EXCEPTION WHEN OTHERS THEN
        -- Fallback: PL/pgSQL with hex-aligned replacement
        EXECUTE $fn$
            CREATE OR REPLACE FUNCTION disa._replace_null_bytes(raw bytea)
            RETURNS bytea
            LANGUAGE plpgsql IMMUTABLE STRICT
            AS $f$
            DECLARE
                h text;
            BEGIN
                h := regexp_replace(encode(raw, 'hex'), '(..)', '\1|', 'g');
                h := replace(h, '00|', '20|');
                h := replace(h, '|', '');
                RETURN decode(h, 'hex');
            END;
            $f$
        $fn$;
        RAISE NOTICE 'disa._replace_null_bytes: using PL/pgSQL fallback (slower)';
    END;
END;
$$;

-- -----------------------------------------------------------------------------
-- fix_bytes(bytea) → text
-- Equivalent of: Core.FixBytes(bytes)
-- Decodes bytea to text, replacing \0 with space
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.fix_bytes(raw bytea)
RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT
AS $$
BEGIN
    RETURN convert_from(disa._replace_null_bytes(raw), 'LATIN1');
END;
$$;

-- -----------------------------------------------------------------------------
-- fix_string(text, start_pos int, end_pos int) → text
-- Equivalent of: Core.FixString(data, start, end)
-- JS substring(start, end) is 0-based. This accepts 0-based offsets.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.fix_string(data text, start_pos int, end_pos int)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    IF data IS NULL THEN RETURN NULL; END IF;
    -- JS substring(start, end) → PG substr(str, start+1, end-start)
    RETURN substring(data FROM start_pos + 1 FOR end_pos - start_pos);
END;
$$;

-- -----------------------------------------------------------------------------
-- fix_string_raw(bytea, start_pos int, end_pos int) → text
-- Combines fix_bytes + fix_string into one call: extracts a bytea slice,
-- replaces nulls in ONLY that small slice, and converts to text.
-- Much faster than fix_bytes(full blob) + fix_string() for targeted extractions
-- (e.g., 5 bytes instead of 700).
-- Accepts 0-based offsets (matching JS source).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.fix_string_raw(raw bytea, start_pos int, end_pos int)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    slice bytea;
BEGIN
    IF raw IS NULL THEN RETURN NULL; END IF;
    slice := substring(raw FROM start_pos + 1 FOR end_pos - start_pos);
    IF slice IS NULL OR octet_length(slice) = 0 THEN RETURN ''; END IF;
    RETURN convert_from(disa._replace_null_bytes(slice), 'LATIN1');
END;
$$;

-- -----------------------------------------------------------------------------
-- trim_val(text) → text
-- Equivalent of: Core.Trim(value)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.trim_val(value text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    IF value IS NULL THEN RETURN NULL; END IF;
    RETURN trim(value);
END;
$$;

-- -----------------------------------------------------------------------------
-- get_byte_at(bytea, pos int) → int
-- Safe wrapper around get_byte with bounds checking. 0-based offset.
-- Returns the raw byte value (0-255) at position pos.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.get_byte_at(raw bytea, pos int)
RETURNS int
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    IF raw IS NULL OR pos < 0 OR pos >= octet_length(raw) THEN RETURN 0; END IF;
    RETURN get_byte(raw, pos);
END;
$$;

-- -----------------------------------------------------------------------------
-- from_disa_date_raw(bytea, offset int) → date
-- Equivalent of: Core.FromDisaDate(dt)
-- Reads 4 bytes starting at offset: day, month, year_lo, year_hi
-- Works directly on bytea to preserve null byte values (byte 0 = value 0).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.from_disa_date_raw(raw bytea, pos int)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    d int;
    m int;
    yr_lo int;
    yr_hi int;
    yr int;
BEGIN
    IF raw IS NULL OR pos < 0 OR pos + 4 > octet_length(raw) THEN RETURN NULL; END IF;

    d     := get_byte(raw, pos);
    m     := get_byte(raw, pos + 1);
    yr_lo := get_byte(raw, pos + 2);
    yr_hi := get_byte(raw, pos + 3);

    IF d = 0 AND m = 0 AND yr_lo = 0 AND yr_hi = 0 THEN RETURN NULL; END IF;

    yr := yr_lo + (yr_hi * 256);

    IF d < 1 OR d > 31 OR m < 1 OR m > 12 OR yr < 1 THEN RETURN NULL; END IF;

    BEGIN
        RETURN make_date(yr, m, d);
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
END;
$$;

-- -----------------------------------------------------------------------------
-- from_disa_time_raw(bytea, offset int) → time
-- Equivalent of: Core.FromDisaTime(dt)
-- Reads 3 bytes starting at offset: second, minute, hour
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.from_disa_time_raw(raw bytea, pos int)
RETURNS time
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    s int;
    mi int;
    h int;
BEGIN
    IF raw IS NULL OR pos < 0 OR pos + 3 > octet_length(raw) THEN RETURN NULL; END IF;

    s  := get_byte(raw, pos);
    mi := get_byte(raw, pos + 1);
    h  := get_byte(raw, pos + 2);

    IF s = 0 AND mi = 0 AND h = 0 THEN RETURN NULL; END IF;

    IF h > 23 OR mi > 59 OR s > 59 THEN RETURN NULL; END IF;

    RETURN make_time(h, mi, s);
END;
$$;

-- -----------------------------------------------------------------------------
-- datetime_value(bytea, date_start, date_end, time_start, time_end) → timestamp
-- Equivalent of: Core.DisaDatetimeValue(bytes, dateStart, dateEnd, timeStart, timeEnd)
-- Offsets are 0-based (matching JS source).
-- date_start = start of 4-byte date, time_start = start of 3-byte time
-- (date_end and time_end kept for API compatibility but only start offsets matter)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.datetime_value(raw bytea, date_start int, date_end int, time_start int, time_end int)
RETURNS timestamp
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    d date;
    t time;
BEGIN
    d := disa.from_disa_date_raw(raw, date_start);
    t := disa.from_disa_time_raw(raw, time_start);

    IF d IS NOT NULL AND t IS NOT NULL THEN
        RETURN d + t;
    END IF;

    RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- from_disa_time_short_raw(bytea, offset) → time
-- Equivalent of: Core.FromDisaTimeShort(dt)
-- Reads 2 bytes at offset
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.from_disa_time_short_raw(raw bytea, pos int)
RETURNS time
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    pre int;
    suf int;
    hours int;
    mins int;
BEGIN
    IF raw IS NULL OR pos < 0 OR pos + 2 > octet_length(raw) THEN RETURN NULL; END IF;

    pre := get_byte(raw, pos);
    suf := get_byte(raw, pos + 1);

    IF pre = 0 AND suf = 0 THEN RETURN NULL; END IF;

    hours := suf / 8;
    mins := ((suf % 8) * 8) + (pre / 32);

    IF hours > 23 OR mins > 59 THEN RETURN NULL; END IF;

    RETURN make_time(hours, mins, 0);
END;
$$;

-- -----------------------------------------------------------------------------
-- from_disa_date_short_raw(bytea, offset) → date
-- Equivalent of: Core.FromDisaDateShort(dt)
-- Reads 2 bytes at offset
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.from_disa_date_short_raw(raw bytea, pos int)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    md int;
    yr_byte int;
    yr int;
    m int;
    d int;
BEGIN
    IF raw IS NULL OR pos < 0 OR pos + 2 > octet_length(raw) THEN RETURN NULL; END IF;

    md := get_byte(raw, pos);
    yr_byte := get_byte(raw, pos + 1);

    IF md = 0 AND yr_byte = 0 THEN RETURN NULL; END IF;

    yr := (yr_byte / 2) + 1980;
    m  := md / 32;
    d  := md % 8;

    IF d < 1 OR d > 31 OR m < 1 OR m > 12 THEN RETURN NULL; END IF;

    BEGIN
        RETURN make_date(yr, m, d);
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
END;
$$;

-- -----------------------------------------------------------------------------
-- datetime_short_value(bytea, start_pos, end_pos) → timestamp
-- Equivalent of: Core.DisaDatetimeShortValue(bytes, start, end)
-- 4 bytes at start_pos: 2-byte time + 2-byte date
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.datetime_short_value(raw bytea, start_pos int, end_pos int)
RETURNS timestamp
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    t time;
    d date;
BEGIN
    t := disa.from_disa_time_short_raw(raw, start_pos);
    d := disa.from_disa_date_short_raw(raw, start_pos + 2);

    IF d IS NOT NULL AND t IS NOT NULL THEN
        RETURN d + t;
    END IF;

    RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- to_uint32(bytea, start_pos, end_pos) → bigint
-- Equivalent of: Core.DisaBitValue → BitConverter.ToInt
-- Interprets up to 4 bytes as a little-endian unsigned 32-bit integer.
-- Offsets are 0-based. Uses get_byte() directly for accurate values.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.to_uint32(raw bytea, start_pos int, end_pos int)
RETURNS bigint
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    result bigint := 0;
    i int;
    n int;
BEGIN
    IF raw IS NULL THEN RETURN NULL; END IF;
    n := least(end_pos - start_pos, 4);

    FOR i IN 0..n - 1 LOOP
        result := result + (get_byte(raw, start_pos + i)::bigint << (8 * i));
    END LOOP;

    RETURN result;
END;
$$;

-- -----------------------------------------------------------------------------
-- to_float32(bytea, start_pos, end_pos) → double precision
-- Equivalent of: BitConverter.ToSingle
-- Interprets 4 bytes as a little-endian IEEE 754 single-precision float.
-- Uses get_byte() directly for accurate byte values.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.to_float32(raw bytea, start_pos int, end_pos int)
RETURNS double precision
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    b0 int; b1 int; b2 int; b3 int;
    sign int;
    exponent int;
    mantissa double precision;
    result double precision;
BEGIN
    IF raw IS NULL OR start_pos + 4 > octet_length(raw) THEN RETURN NULL; END IF;

    b0 := get_byte(raw, start_pos);
    b1 := get_byte(raw, start_pos + 1);
    b2 := get_byte(raw, start_pos + 2);
    b3 := get_byte(raw, start_pos + 3);

    sign := (b3 >> 7) & 1;
    exponent := ((b3 & 127) << 1) | ((b2 >> 7) & 1);
    mantissa := ((b2 & 127)::bigint << 16) | (b1::bigint << 8) | b0::bigint;

    IF exponent = 0 AND mantissa = 0 THEN RETURN 0.0; END IF;
    IF exponent = 255 THEN RETURN NULL; END IF;

    IF exponent = 0 THEN
        result := power(-1, sign) * power(2, -126) * (mantissa / 8388608.0);
    ELSE
        result := power(-1, sign) * power(2, exponent - 127) * (1.0 + mantissa / 8388608.0);
    END IF;

    RETURN result;
END;
$$;

-- -----------------------------------------------------------------------------
-- dob_or_age_value(bytea, date_start, date_end, time_start, time_end) → date
-- Equivalent of: Core.DisaDateOfBirthOrAgeValue
-- Extracts DOB from REGDAT4 considering age offsets at bytes 414-419
-- Uses get_byte() for the age byte values.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disa.dob_or_age_value(raw bytea, date_start int, date_end int, time_start int, time_end int)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    years int;
    days int;
    hours int;
    d date;
    t time;
    dt timestamp;
BEGIN
    IF raw IS NULL THEN RETURN NULL; END IF;

    years := get_byte(raw, 414);
    days  := get_byte(raw, 416);
    hours := get_byte(raw, 418);

    d := disa.from_disa_date_raw(raw, date_start);
    t := disa.from_disa_time_raw(raw, time_start);

    IF d IS NOT NULL AND t IS NOT NULL THEN
        dt := d + t;
        IF years > 0 THEN dt := dt - (years || ' years')::interval; END IF;
        IF days > 0 THEN dt := dt - (days || ' days')::interval; END IF;
        IF hours > 0 THEN dt := dt - (hours || ' hours')::interval; END IF;
        RETURN dt::date;
    END IF;

    RETURN NULL;
END;
$$;
