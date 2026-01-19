import * as z from "zod/v4/core";
import { inferFieldType } from "./field-type-inference";
import { getDefaultValueInZodStack } from "./default-values";
import { getFieldConfigInZodStack } from "./field-config";
import { ParsedField, ParsedSchema } from "@/lib/autoform/core";

function processField(
  baseSchema: any,
  fieldConfig: any,
  type: string
): [string, string][] {
  let optionValues: [string, string][] = [];

  // Enums
  const options = (baseSchema as z.$ZodEnum)._zod.def.entries;

  if (options) {
    if (!Array.isArray(options)) {
      optionValues = Object.entries(options) as [string, string][];
    } else {
      optionValues = options.map((value) => [value, value]);
    }
  } else if (type === "date") {
    const dateOptions: any = {};
    const dateFormat = (baseSchema as any).dateFormat;
    if (dateFormat) dateOptions["format"] = dateFormat;

    optionValues = Object.entries(dateOptions) as [string, string][];
  } else if (type === "reference") {
    const refOptions: any = {};
    const reference = (baseSchema as any)._zod.def.reference;
    if (reference) refOptions["reference"] = reference;
    optionValues = Object.entries(refOptions) as [string, string][];
  } else if (type === "file") {
    const fileOptions: any = {};
    const file = (baseSchema as any)._zod.def.file;
    if (file) fileOptions["file"] = file;
    optionValues = Object.entries(fileOptions) as [string, string][];
  }

  return optionValues;
}

function parseField(key: string, schema: z.$ZodType): ParsedField {
  let baseSchema = getBaseSchema(schema);
  let fieldConfig = getFieldConfigInZodStack(schema);
  let type = inferFieldType(baseSchema, fieldConfig);
  const defaultValue = getDefaultValueInZodStack(schema);

  let optionValues: [string, string][] = processField(
    baseSchema,
    fieldConfig,
    type
  );

  if ((baseSchema as any).type === "union") {
    const _options = (baseSchema as any)._zod.def.options;
    baseSchema = getBaseSchema(_options[0]);
    type = inferFieldType(baseSchema, fieldConfig);
    optionValues = processField(baseSchema, fieldConfig, type);
  }

  // Arrays and objects
  let subSchema: ParsedField[] = [];
  if (baseSchema instanceof z.$ZodObject) {
    subSchema = Object.entries(baseSchema._zod.def.shape).map(([key, field]) =>
      parseField(key, field as z.$ZodType)
    );
  }
  if (baseSchema instanceof z.$ZodArray) {
    subSchema = [parseField("0", baseSchema._zod.def.element as z.$ZodType)];
  }

  if (type === "string") {
    if (baseSchema instanceof z.$ZodUUID) {
      optionValues["format"] = "uuid";
    } else if (baseSchema instanceof z.$ZodEmail) {
      optionValues["format"] = "email";
    } else if (baseSchema instanceof z.$ZodURL) {
      optionValues["format"] = "url";
    }
  }

  return {
    key,
    type,
    required: !isOptional(schema),
    default: defaultValue,
    description: getDescription(schema),
    fieldConfig,
    options: optionValues,
    schema: subSchema,
  };
}

export function parseSchema(schema: z.$ZodObject): ParsedSchema {
  const shape = schema._zod.def.shape;

  if (shape) {
    const fields: ParsedField[] = Object.entries(shape).map(([key, field]) =>
      parseField(key, field as z.$ZodType)
    );

    return { fields };
  }

  return { fields: [] };
}

function getBaseSchema<SchemaType extends z.$ZodType>(
  schema: SchemaType | z.$ZodDefault<SchemaType>
): SchemaType {
  if ("innerType" in schema._zod.def) {
    return getBaseSchema(schema._zod.def.innerType as SchemaType);
  }

  return schema as SchemaType;
}

function isOptional<SchemaType extends z.$ZodType>(
  schema: SchemaType
): boolean {
  if (schema._zod.def.type === "optional") {
    return true;
  }

  if ("innerType" in schema._zod.def) {
    return isOptional(schema._zod.def.innerType as SchemaType);
  }

  return false;
}

function getDescription<SchemaType extends z.$ZodType>(
  schema: SchemaType
): string | undefined {
  const description = z.globalRegistry.get(schema)?.description;
  if (description) {
    return description;
  }

  if ("innerType" in schema._zod.def) {
    return getDescription(schema._zod.def.innerType as SchemaType);
  }

  return undefined;
}
