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

export function fieldToSchemaProperty(field: FormField): JSONSchemaProperty {
  const prop: JSONSchemaProperty = {};

  if (field.label) prop.title = field.label;
  if (field.description || field.placeholder)
    prop.description = field.description || field.placeholder;

  switch (field.type) {
    case "string":
      prop.type = "string";
      if (field.validation?.minLength)
        prop.minLength = field.validation.minLength;
      if (field.validation?.maxLength)
        prop.maxLength = field.validation.maxLength;
      if (field.validation?.pattern) prop.pattern = field.validation.pattern;
      break;
    case "number":
      prop.type = "number";
      if (field.validation?.min !== undefined)
        prop.minimum = field.validation.min;
      if (field.validation?.max !== undefined)
        prop.maximum = field.validation.max;
      break;
    case "boolean":
      prop.type = "boolean";
      break;
    case "date":
      prop.type = "string";
      prop.format = "date";
      break;
    case "select":
    case "options":
      prop.type = "string";
      if (field.options) {
        prop.enum = field.options
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      break;
    case "reference":
      prop.type = "string";
      prop.format = "reference";
      break;
    case "file":
      prop.type = "string";
      prop.format = "binary";
      break;
  }

  if (field.defaultValue) prop.default = field.defaultValue;

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
