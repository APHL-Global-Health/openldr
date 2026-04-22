import { type PluginParams } from "../types";
import { pool } from "../lib/db";
import { v7 as uuidv7 } from "uuid";

async function createPlugin({
  pluginId,
  pluginType,
  pluginName,
  pluginVersion,
  pluginData,
  pluginMinioObjectPath,
  securityLevel,
  config,
  notes,
}: PluginParams) {
  const plugins = await getPluginBySearch({
    pluginType,
    pluginName,
    pluginVersion,
  });
  if (plugins.length >= 1) {
    throw new Error(
      `Plugin already exists for plugin type: ${pluginType}, plugin name: ${pluginName}, and plugin version: ${pluginVersion}.`,
    );
  }

  const id = pluginId || uuidv7();
  const result = await pool.query(
    `INSERT INTO plugins ("pluginId", "pluginType", "pluginName", "pluginVersion", "pluginMinioObjectPath", "securityLevel", config, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      pluginType,
      pluginName,
      pluginVersion,
      pluginMinioObjectPath,
      securityLevel,
      config ? JSON.stringify(config) : null,
      notes,
    ],
  );
  return result.rows[0];
}

async function getPluginById(pluginId: string) {
  const result = await pool.query(
    `SELECT * FROM plugins WHERE "pluginId" = $1`,
    [pluginId],
  );
  return result.rows[0] || null;
}

async function getPluginBySearch({
  pluginType,
  pluginName,
  pluginVersion,
}: {
  pluginType: any;
  pluginName: any;
  pluginVersion: any;
}) {
  const result = await pool.query(
    `SELECT * FROM plugins WHERE "pluginType" = $1 AND "pluginName" = $2 AND "pluginVersion" = $3`,
    [pluginType, pluginName, pluginVersion],
  );
  return result.rows;
}

async function getAllPlugins() {
  try {
    const result = await pool.query(`SELECT * FROM plugins`);
    return result.rows;
  } catch (error) {
    console.error("Error getting all plugins:", error);
    throw error;
  }
}

async function updatePlugin({
  pluginId,
  pluginType,
  pluginName,
  pluginVersion,
  pluginData,
  pluginMinioObjectPath,
  securityLevel,
  config,
  notes,
}: PluginParams) {
  try {
    const result = await pool.query(
      `UPDATE plugins
       SET "pluginType" = $1, "pluginName" = $2, "pluginVersion" = $3,
           "pluginMinioObjectPath" = $4, "securityLevel" = $5, config = $6, notes = $7
       WHERE "pluginId" = $8
       RETURNING *`,
      [
        pluginType,
        pluginName,
        pluginVersion,
        pluginMinioObjectPath,
        securityLevel,
        config ? JSON.stringify(config) : null,
        notes,
        pluginId,
      ],
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error updating plugin:", error);
    throw error;
  }
}

async function deletePlugin(pluginId: string) {
  try {
    const result = await pool.query(
      `DELETE FROM plugins WHERE "pluginId" = $1`,
      [pluginId],
    );
    return result.rowCount;
  } catch (error) {
    console.error("Error deleting plugin:", error);
    throw error;
  }
}

async function getPluginsByType(pluginType: any) {
  try {
    const result = await pool.query(
      `SELECT * FROM plugins WHERE "pluginType" = $1`,
      [pluginType],
    );
    return result.rows;
  } catch (error) {
    console.error(
      `Error getting all plugins for type: {${pluginType}} :`,
      error,
    );
    throw error;
  }
}

export {
  createPlugin,
  getPluginById,
  getPluginBySearch,
  getAllPlugins,
  updatePlugin,
  deletePlugin,
  getPluginsByType,
};
