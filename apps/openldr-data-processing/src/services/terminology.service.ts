import { externalPool } from "../lib/db.external";
import { logger } from "../lib/logger";

/**
 * Fetches all active concepts and their cross-system mappings for a given
 * coding system from openldr_external and returns them in the same shape that
 * applyTerminologyMappings() already consumes:
 *
 *   {
 *     concepts: {
 *       "<concept_code>": {
 *         concept:  { code, name },
 *         mappings: [{ relationship, externalId, toConceptCode, toConceptName,
 *                      toSourceName, toSourceOwner, toSourceUrl }]
 *       }
 *     }
 *   }
 */
export async function getConceptsBySystem(systemCode: string): Promise<{
  concepts: Record<string, any>;
}> {
  const sql = `
    SELECT
      c.concept_code,
      c.display_name,
      COALESCE(
        json_agg(
          json_build_object(
            'relationship',  cm.map_type,
            'externalId',    cm.id::text,
            'toConceptCode', COALESCE(tc.concept_code,  cm.to_concept_code),
            'toConceptName', COALESCE(tc.display_name,  cm.to_concept_name),
            'toSourceName',  COALESCE(tcs.system_code,  cm.to_system_code),
            'toSourceOwner', tcs.owner,
            'toSourceUrl',   tcs.system_uri
          ) ORDER BY cm.created_at
        ) FILTER (WHERE cm.id IS NOT NULL),
        '[]'::json
      ) AS mappings
    FROM concepts c
    JOIN  coding_systems cs  ON c.system_id          = cs.id
    LEFT JOIN concept_mappings cm  ON cm.from_concept_id = c.id  AND cm.is_active = true
    LEFT JOIN concepts tc           ON cm.to_concept_id   = tc.id
    LEFT JOIN coding_systems tcs    ON tc.system_id       = tcs.id
    WHERE cs.system_code = $1
      AND c.is_active    = true
      AND c.retired      = false
    GROUP BY c.concept_code, c.display_name
  `;

  try {
    const result = await externalPool.query(sql, [systemCode]);

    const concepts: Record<string, any> = {};
    for (const row of result.rows) {
      concepts[row.concept_code] = {
        concept: {
          code: row.concept_code,
          name: row.display_name,
        },
        mappings: row.mappings ?? [],
      };
    }

    logger.info(
      { systemCode, count: result.rowCount },
      "Loaded concepts from openldr_external",
    );

    return { concepts };
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack, systemCode },
      "Failed to query concepts from openldr_external",
    );
    throw error;
  }
}
