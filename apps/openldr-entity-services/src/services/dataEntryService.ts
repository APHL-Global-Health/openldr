import { DynamicModelManager } from "@openldr/internal-database";

const { models } = require("@openldr/internal-database");
const { SchemaModel } = models;

function columnsToJsonSchema(
  columns: any[],
  title: string,
  description: string,
  additionalProperties: boolean = false
) {
  const properties: any = {};
  const required: any = [];

  // Type mapping from database types to JSON Schema types
  const typeMap: any = {
    char: "string",
    varchar: "string",
    text: "string",
    int: "integer",
    integer: "integer",
    bigint: "integer",
    float: "number",
    double: "number",
    decimal: "number",
    boolean: "boolean",
    bool: "boolean",
    date: "string",
    datetime: "string",
    timestamp: "string",
    json: ["object", "string"],
    enum: "string",
  };

  columns.forEach((column: any) => {
    const property: any = {};

    // Map the type
    const jsonType = typeMap[column.Type.toLowerCase()] || "string";
    property.type = jsonType;

    if (column.Type.toLowerCase() === "uuid") {
      property.format = "uuid";
    }

    if (["date", "datetime", "timestamp"].includes(column.Type.toLowerCase())) {
      property.type = ["object", "string"];
      property.format = "date-time";
      // column.Type.toLowerCase() === "date" ? "date-time" : "date-time";

      if (column.Type.toLowerCase() === "date") {
        property["x-zodType"] = "date";
        property["x-zodOptions"] = [["format", "yyyy-MM-dd"]];
      } else if (column.Type.toLowerCase() === "datetime") {
        property["x-zodType"] = "datetime";
        property["x-zodOptions"] = [["format", "yyyy-MM-dd hh:mm:ss"]];
      } else if (column.Type.toLowerCase() === "timestamp") {
        property["x-zodType"] = "timestamp";
        property["x-zodOptions"] = [["format", "yyyy-MM-dd hh:mm:ss"]];
      }
    }

    // Handle enum constraints
    if (
      column.Type.toLowerCase() === "enum" &&
      Array.isArray(column.Constraint)
    ) {
      //   property.enum = column.Constraint;

      property.type = ["object", "string"];
      property["x-zodType"] = "options";
      property["x-zodOptions"] = column.Constraint.map((val: string) => [
        val,
        val,
      ]);
    }

    // Handle string length constraints
    if (
      (column.Type.toLowerCase() === "char" ||
        column.Type.toLowerCase() === "varchar") &&
      typeof column.Constraint === "number"
    ) {
      property.maxLength = column.Constraint;
    }

    // Add description for primary keys
    if (column.PrimaryKey) {
      //Skip for now
      property.description = "Primary key";
    } else {
      properties[column.Name] = property;
    }

    // Add to required array if not nullable
    if (
      !column.Nullable &&
      !column.PrimaryKey &&
      !["createdAt", "updatedAt"].includes(column.Name)
    ) {
      required.push(column.Name);
    }
  });

  // Build the schema
  const schema: any = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: title,
    description: description,
    type: "object",
    properties: properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties,
  };

  // Remove undefined values
  if (!schema.required) {
    delete schema.required;
  }

  return schema;
}

async function getEnryForm(
  modelManager: DynamicModelManager,
  form: string,
  version: string,
  type: string,
  additionalProperties: boolean = false
) {
  const model = await modelManager.getModel("formSchemas"!);
  const info = await model.findOne({
    attributes: ["schema"],
    where: {
      isActive: true,
      schemaType: type,
      schemaName: form,
      version: version,
    },
  });

  if (info) {
    const schema = info.schema;
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

async function getAllEntryForms(
  modelManager: DynamicModelManager,
  type: string
) {
  try {
    const model = await modelManager.getModel("formSchemas"!);
    const forms = await model.findAll({
      attributes: ["schemaId", "schemaName", "version", "dataFeedId"],
      where: {
        isActive: true,
        schemaType: type,
      },
    });

    return forms.map((form) => ({
      id: form.schemaId,
      name: form.schemaName,
      version: form.version,
      feed: form.dataFeedId,
    }));
  } catch (error) {
    console.error("Error getting all entry forms:", error);
    throw error;
  }
}

export { getEnryForm, getAllEntryForms };
