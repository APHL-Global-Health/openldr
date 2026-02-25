import { pool } from "../lib/db";
import { logger } from "../lib/logger";

// get the facility by id
export async function getFacilityById(facilityId: string) {
  try {
    const sql = `
        SELECT * 
        FROM "facilities" 
        WHERE "facilityId" = $1;
    `;
    const res = await pool.query(sql, [facilityId]);
    if (res.rowCount == 1) {
      return res.rows[0];
    }

    return null;
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Database query error",
    );
    throw error;
  }
}
