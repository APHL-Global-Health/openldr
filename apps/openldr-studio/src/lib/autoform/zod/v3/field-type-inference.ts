import { type FieldConfig } from "@/lib/autoform/core";
import { z } from "zod/v3";
// import { ZodOptions, ZodDate } from "@repo/openldr-core/lib/schemaUtils";

export function inferFieldType(
  schema: z.ZodTypeAny,
  fieldConfig?: FieldConfig,
): string {
  if (fieldConfig?.fieldType) {
    return fieldConfig.fieldType;
  }

  if (schema instanceof z.ZodObject) return "object";
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodEnum) return "select";
  if (schema instanceof z.ZodNativeEnum) return "select";
  if (schema instanceof z.ZodArray) return "array";
  // if (schema instanceof ZodOptions) return "options";
  // if (schema instanceof ZodDate) return "date";

  return "string"; // Default to string for unknown types
}
