import type {
  FormDefinition,
  FormField,
  FieldType,
  JSONSchema,
  JSONSchemaProperty,
} from "@/types/forms";

const VISUAL_TYPES: FieldType[] = ["label", "separator"];

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

  // Helper to clean custom extensions
  const clearExtensions = () => {
    delete prop["x-zodType"];
    delete prop["x-zodOptions"];
    delete prop["x-zodReference"];
    delete prop["x-zodFile"];
    delete prop["x-zodLabel"];
  };

  switch (field.type) {
    case "string": {
      prop.type = "string";
      clearExtensions();

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

    case "textarea": {
      prop.type = "string";
      clearExtensions();
      prop["x-zodType"] = "textarea";

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
      clearExtensions();

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
      clearExtensions();
      break;

    case "date": {
      const fmt = field.dateConfig?.format ?? "yyyy-MM-dd";
      const hasTime = fmt.includes("H") || fmt.includes("h") || fmt.includes("m");
      prop.type = ["object", "string"];
      prop.format = hasTime ? "datetime" : "date";
      clearExtensions();
      prop["x-zodType"] = "date";
      prop["x-zodOptions"] = [["format", fmt]];
      delete prop.enum;
      break;
    }

    case "select": {
      prop.type = "string";
      clearExtensions();
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
      clearExtensions();
      prop["x-zodType"] = "options";
      prop["x-zodOptions"] = entries;
      prop.enum = entries.map(([, label]) => label);
      break;
    }

    case "reference": {
      const cfg = field.referenceConfig;
      prop.type = ["object", "string"];
      prop.format = "uuid";
      clearExtensions();
      prop["x-zodType"] = "reference";
      if (cfg) {
        prop["x-zodReference"] = {
          table: cfg.table,
          key: cfg.key,
          attributes: cfg.attributes,
        };
      }
      delete prop.enum;
      break;
    }

    case "file": {
      const cfg = field.fileConfig;
      prop.type = ["object", "string"];
      clearExtensions();
      prop["x-zodType"] = "file";
      if (cfg) {
        prop["x-zodFile"] = {
          file: "",
          key: field.key,
          content: "",
          mimes: cfg.mimes,
        };
      }
      delete prop.enum;
      break;
    }

    case "label": {
      prop.type = "null";
      clearExtensions();
      prop["x-zodType"] = "label";
      prop["x-zodLabel"] = {
        text: field.labelConfig?.text ?? field.label,
        variant: field.labelConfig?.variant ?? "h3",
      };
      delete prop.enum;
      break;
    }

    case "separator": {
      prop.type = "null";
      clearExtensions();
      prop["x-zodType"] = "separator";
      delete prop.enum;
      break;
    }
  }

  // Default value (not for visual types)
  if (!VISUAL_TYPES.includes(field.type)) {
    if (field.defaultValue) prop.default = field.defaultValue;
    else delete prop.default;
  }

  // Visibility conditions
  if (field.visibility && field.visibility.conditions.length > 0) {
    prop["x-zodVisibility"] = field.visibility;
  } else {
    delete prop["x-zodVisibility"];
  }

  return prop;
}

export function formToJSONSchema(form: FormDefinition): JSONSchema {
  const properties: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];
  const conditionalRules: any[] = [];

  for (const field of form.fields) {
    const key = field.key || generateKey(field.label) || `field_${field.id}`;
    properties[key] = fieldToSchemaProperty(field);

    if (VISUAL_TYPES.includes(field.type)) continue;

    if (field.required && field.visibility?.conditions?.length) {
      // Emit if/then so backend validators enforce conditional required
      const ifClause = buildVisibilityIfClause(field.visibility);
      if (ifClause) {
        conditionalRules.push({
          if: ifClause,
          then: { required: [key] },
        });
      }
    } else if (field.required) {
      required.push(key);
    }
  }

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: form.name,
    ...(form.description ? { description: form.description } : {}),
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
    ...(conditionalRules.length ? { allOf: conditionalRules } : {}),
  };
}

/** Convert a VisibilityRule into a JSON Schema `if` clause. */
function buildVisibilityIfClause(
  visibility: import("@/types/forms").VisibilityRule,
): any | null {
  const conditionSchemas = visibility.conditions
    .map((cond) => {
      switch (cond.operator) {
        case "equals":
          return { properties: { [cond.field]: { const: cond.value } } };
        case "notEquals":
          return {
            properties: { [cond.field]: { not: { const: cond.value } } },
          };
        default:
          return null;
      }
    })
    .filter(Boolean);

  if (conditionSchemas.length === 0) return null;
  if (conditionSchemas.length === 1) return conditionSchemas[0];

  return visibility.logic === "and"
    ? { allOf: conditionSchemas }
    : { anyOf: conditionSchemas };
}

export function formatSchemaJson(form: FormDefinition): string {
  return JSON.stringify(formToJSONSchema(form), null, 2);
}
