import { pool } from "../lib/db";

async function getEntryForm(
  form: string,
  version: string,
  type: string,
  additionalProperties: boolean = false,
) {
  const result = await pool.query(
    `SELECT schema FROM "formSchemas"
     WHERE "isActive" = true AND "schemaType" = $1 AND "schemaName" = $2 AND version = $3
     LIMIT 1`,
    [type, form, version],
  );

  if (result.rows.length > 0) {
    const schema = result.rows[0].schema;
    schema.additionalProperties = additionalProperties;
    return schema;
  }

  return {
    type: "object",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    required: [],
    properties: {},
    title: "Unknown Entry Form",
    description: `Can't find form ${form} with version ${version} and type ${type}`,
    additionalProperties: false,
  };
}

async function getAllEntryForms(type: string) {
  try {
    const result = await pool.query(
      `SELECT 
        "schemaId" as "id", 
        "schemaName" as "name", 
        "version" as "version", 
        "dataFeedId" as "feed"
       FROM "formSchemas"
       WHERE "isActive" = true AND "schemaType" = $1`,
      [type],
    );

    return result.rows;
  } catch (error) {
    console.error("Error getting all entry forms:", error);
    throw error;
  }
}

export { getEntryForm, getAllEntryForms };
