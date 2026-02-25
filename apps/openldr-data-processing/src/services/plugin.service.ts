import { pool } from "../lib/db";
import { logger } from "../lib/logger";

// get the data feed by id and include the associated project and use case
export async function getPluginById({ pluginID }: { pluginID: string }) {
  try {
    const sql = `
        SELECT * 
        FROM "plugins" 
        WHERE "pluginId" = $1;
    `;
    const res = await pool.query(sql, [pluginID]);
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
