import { pool } from "../lib/db";
import { logger } from "../lib/logger";

// get the data feed by id and include the associated project and use case
export async function getDataFeedById(dataFeedId: string) {
  try {
    const sql = `
        SELECT
            df.*,
            uc."projectId",
            json_build_object(
                'pluginId', sp."pluginId",
                'pluginType', sp."pluginType",
                'pluginName', sp."pluginName",
                'pluginVersion', sp."pluginVersion",
                'pluginMinioObjectPath', sp."pluginMinioObjectPath",
                'securityLevel', sp."securityLevel",
                'config', sp."config",
                'notes', sp."notes"
            ) AS "schemaPlugin",
            json_build_object(
                'pluginId', mp."pluginId",
                'pluginType', mp."pluginType",
                'pluginName', mp."pluginName",
                'pluginVersion', mp."pluginVersion",
                'pluginMinioObjectPath', mp."pluginMinioObjectPath",
                'securityLevel', mp."securityLevel",
                'config', mp."config",
                'notes', mp."notes"
            ) AS "mapperPlugin",
            json_build_object(
                'pluginId', stp."pluginId",
                'pluginType', stp."pluginType",
                'pluginName', stp."pluginName",
                'pluginVersion', stp."pluginVersion",
                'pluginMinioObjectPath', stp."pluginMinioObjectPath",
                'securityLevel', stp."securityLevel",
                'config', stp."config",
                'notes', stp."notes"
            ) AS "storagePlugin",
            json_build_object(
                'pluginId', op."pluginId",
                'pluginType', op."pluginType",
                'pluginName', op."pluginName",
                'pluginVersion', op."pluginVersion",
                'pluginMinioObjectPath', op."pluginMinioObjectPath",
                'securityLevel', op."securityLevel",
                'config', op."config",
                'notes', op."notes"
            ) AS "outpostPlugin",
            json_build_object(
                'projectId', p."projectId",
                'projectName', p."projectName",
                'description', p."description",
                'isEnabled', p."isEnabled"
            ) AS project,
            json_build_object(
                'useCaseId', uc."useCaseId",
                'useCaseName', uc."useCaseName",
                'description', uc."description",
                'isEnabled', uc."isEnabled"
            ) AS "useCase"
        FROM "dataFeeds" df
        LEFT JOIN "plugins" sp ON df."schemaPluginId" = sp."pluginId" AND sp."pluginType" = 'validation'
        LEFT JOIN "plugins" mp ON df."mapperPluginId" = mp."pluginId" AND mp."pluginType" = 'mapping'
        LEFT JOIN "plugins" stp ON df."storagePluginId" = stp."pluginId" AND stp."pluginType" = 'storage'
        LEFT JOIN "plugins" op ON df."outpostPluginId" = op."pluginId" AND op."pluginType" = 'outpost'
        LEFT JOIN "useCases" uc ON df."useCaseId" = uc."useCaseId"
		LEFT JOIN "projects" p ON uc."projectId" = p."projectId"   
        WHERE df."dataFeedId" = $1;
    `;
    const res = await pool.query(sql, [dataFeedId]);
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
