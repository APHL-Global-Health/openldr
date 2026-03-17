/*
 * openldr_utils.c — Fast bytea null-byte replacement for binary parsing.
 *
 * PostgreSQL's text type cannot hold \x00. For systems that store data in
 * binary IMAGE columns that contain null bytes. Before we can convert to text
 * via convert_from(), we must replace \x00 with \x20 (space).
 *
 * In PL/pgSQL this requires either a byte-by-byte loop (slow) or hex
 * encode/decode tricks (fragile). In C it's a single memcpy + loop — orders
 * of magnitude faster for the 45M+ rows we process during migration.
 */

#include "postgres.h"
#include "fmgr.h"
#include "varatt.h"

PG_MODULE_MAGIC;

PG_FUNCTION_INFO_V1(bytea_replace_null);

/*
 * bytea_replace_null(bytea) → bytea
 *
 * Returns a copy of the input with every \x00 byte replaced by \x20 (space).
 * Uses PG_GETARG_BYTEA_P_COPY so we can mutate in place without an extra
 * allocation.
 */
Datum
bytea_replace_null(PG_FUNCTION_ARGS)
{
    bytea      *input = PG_GETARG_BYTEA_P_COPY(0);
    int         len   = VARSIZE_ANY_EXHDR(input);
    unsigned char *data = (unsigned char *) VARDATA(input);
    int         i;

    for (i = 0; i < len; i++)
    {
        if (data[i] == 0x00)
            data[i] = 0x20;
    }

    PG_RETURN_BYTEA_P(input);
}
