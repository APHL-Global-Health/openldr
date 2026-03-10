import type {
  FormDefinition,
  FormField,
  JSONSchema,
  JSONSchemaProperty,
} from "@/types/forms";

export function generateKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Convert a FormField to a JSON Schema property.
 * Starts from `_schemaProperty` (original) if available to preserve unknown extensions,
 * then overlays edits from the FormField's typed config fields.
 */
export function fieldToSchemaProperty(field: FormField): JSONSchemaProperty {
  const prop: JSONSchemaProperty = field._schemaProperty
    ? structuredClone(field._schemaProperty)
    : {};

  // Common properties
  if (field.label) prop.title = field.label;
  if (field.description || field.placeholder) {
    prop.description = field.description || field.placeholder;
  } else if (!field._schemaProperty) {
    delete prop.description;
  }

  switch (field.type) {
    case "string": {
      prop.type = "string";
      delete prop["x-zodType"];
      delete prop["x-zodOptions"];
      delete prop["x-zodReference"];
      delete prop["x-zodFile"];

      const fmt = field.stringConfig?.format;
      if (fmt) prop.format = fmt;
      else if (!field._schemaProperty) delete prop.format;

      if (field.validation?.minLength) prop.minLength = field.validation.minLength;
      else delete prop.minLength;
      if (field.validation?.maxLength) prop.maxLength = field.validation.maxLength;
      else delete prop.maxLength;
      if (field.validation?.pattern) prop.pattern = field.validation.pattern;
      else delete prop.pattern;
      break;
    }

    case "number": {
      prop.type = "number";
      delete prop["x-zodType"];
      delete prop["x-zodOptions"];
      delete prop["x-zodReference"];
      delete prop["x-zodFile"];

      if (field.validation?.min !== undefined) prop.minimum = field.validation.min;
      else delete prop.minimum;
      if (field.validation?.max !== undefined) prop.maximum = field.validation.max;
      else delete prop.maximum;
      if (field.numberConfig?.exclusiveMin !== undefined)
        prop.exclusiveMinimum = field.numberConfig.exclusiveMin;
      else delete prop.exclusiveMinimum;
      if (field.numberConfig?.exclusiveMax !== undefined)
        prop.exclusiveMaximum = field.numberConfig.exclusiveMax;
      else delete prop.exclusiveMaximum;
      if (field.numberConfig?.multipleOf !== undefined)
        prop.multipleOf = field.numberConfig.multipleOf;
      else delete prop.multipleOf;
      break;
    }

    case "boolean":
      prop.type = "boolean";
      delete prop["x-zodType"];
      delete prop["x-zodOptions"];
      delete prop["x-zodReference"];
      delete prop["x-zodFile"];
      break;

    case "date": {
      const fmt = field.dateConfig?.format ?? "yyyy-MM-dd";
      const hasTime = fmt.includes("H") || fmt.includes("h") || fmt.includes("m");
      prop.type = ["object", "string"];
      prop.format = hasTime ? "datetime" : "date";
      prop["x-zodType"] = "date";
      prop["x-zodOptions"] = [["format", fmt]];
      delete prop["x-zodReference"];
      delete prop["x-zodFile"];
      delete prop.enum;
      break;
    }

    case "select": {
      prop.type = "string";
      delete prop["x-zodType"];
      delete prop["x-zodOptions"];
      delete prop["x-zodReference"];
      delete prop["x-zodFile"];
      if (field.options) {
        prop.enum = field.options.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        delete prop.enum;
      }
      break;
    }

    case "options": {
      const entries = field.optionsConfig?.entries ?? [];
      prop.type = ["object", "enum"];
      prop["x-zodType"] = "options";
      prop["x-zodOptions"] = entries;
      prop.enum = entries.map(([, label]) => label);
      delete prop["x-zodReference"];
      delete prop["x-zodFile"];
      break;
    }

    case "reference": {
      const cfg = field.referenceConfig;
      prop.type = ["object", "string"];
      prop.format = "uuid";
      prop["x-zodType"] = "reference";
      if (cfg) {
        prop["x-zodReference"] = {
          table: cfg.table,
          key: cfg.key,
          attributes: cfg.attributes,
        };
      }
      delete prop["x-zodOptions"];
      delete prop["x-zodFile"];
      delete prop.enum;
      break;
    }

    case "file": {
      const cfg = field.fileConfig;
      prop.type = ["object", "string"];
      prop["x-zodType"] = "file";
      if (cfg) {
        prop["x-zodFile"] = {
          file: "",
          key: field.key,
          content: "",
          mimes: cfg.mimes,
        };
      }
      delete prop["x-zodOptions"];
      delete prop["x-zodReference"];
      delete prop.enum;
      break;
    }
  }

  if (field.defaultValue) prop.default = field.defaultValue;
  else delete prop.default;

  return prop;
}

export function formToJSONSchema(form: FormDefinition): JSONSchema {
  const properties: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];

  for (const field of form.fields) {
    const key = field.key || generateKey(field.label) || `field_${field.id}`;
    properties[key] = fieldToSchemaProperty(field);
    if (field.required) required.push(key);
  }

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: form.name,
    ...(form.description ? { description: form.description } : {}),
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };
}

export function formatSchemaJson(form: FormDefinition): string {
  return JSON.stringify(formToJSONSchema(form), null, 2);
}
