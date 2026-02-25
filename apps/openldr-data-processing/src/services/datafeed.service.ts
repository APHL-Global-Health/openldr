import { pool } from "../lib/db";
import { logger } from "../lib/logger";

// get the data feed by id and include the associated project and use case
export async function getDataFeedById(dataFeedId: string) {
  try {
    const sql = `
        SELECT
            df.*,
            json_build_object(
                'facilityId', f."facilityId",
                'facilityCode', f."facilityCode",
                'facilityName', f."facilityName",
                'facilityType', f."facilityType",
                'description', f."description",
                'countryCode', f."countryCode",
                'provinceCode', f."provinceCode",
                'regionCode', f."regionCode",
                'districtCode', f."districtCode",
                'subDistrictCode', f."subDistrictCode",
                'latitude', f."latitude",
                'longitude', f."longitude"
            ) AS facility,
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
                'pluginId', rp."pluginId",
                'pluginType', rp."pluginType",
                'pluginName', rp."pluginName",
                'pluginVersion', rp."pluginVersion",
                'pluginMinioObjectPath', rp."pluginMinioObjectPath",
                'securityLevel', rp."securityLevel",
                'config', rp."config",
                'notes', rp."notes"
            ) AS "recipientPlugin",
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
        LEFT JOIN "facilities" f ON df."facilityId" = f."facilityId"
        LEFT JOIN "plugins" sp ON df."schemaPluginId" = sp."pluginId" AND sp."pluginType" = 'schema'
        LEFT JOIN "plugins" mp ON df."mapperPluginId" = mp."pluginId" AND mp."pluginType" = 'mapper'
        LEFT JOIN "plugins" rp ON df."recipientPluginId" = rp."pluginId" AND rp."pluginType" = 'recipient'
        LEFT JOIN "projects" p ON df."projectId" = p."projectId"
        LEFT JOIN "useCases" uc ON df."useCaseId" = uc."useCaseId"
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
