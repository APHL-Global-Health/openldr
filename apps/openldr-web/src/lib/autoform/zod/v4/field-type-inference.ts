import { FieldConfig } from "@/lib/autoform/core";
import { ZodOptions, ZodDate, ZodReference, ZodFile } from "@/lib/schemaUtils";
import * as z from "zod/v4/core";

export function inferFieldType(
  schema: z.$ZodType,
  fieldConfig?: FieldConfig
): string {
  if (fieldConfig?.fieldType) {
    return fieldConfig.fieldType;
  }

  if (schema instanceof ZodReference) return "reference";
  if (schema instanceof ZodFile) return "file";
  if (schema instanceof z.$ZodObject) return "object";
  if (schema instanceof z.$ZodString) return "string";
  if (schema instanceof z.$ZodNumber) return "number";
  if (schema instanceof z.$ZodBoolean) return "boolean";
  // if (schema instanceof z.$ZodDate) return "date";
  if (schema instanceof z.$ZodEnum) return "select";
  if (schema instanceof z.$ZodArray) return "array";
  if (schema instanceof ZodOptions) return "options";
  if (schema instanceof ZodDate) return "date";

  return "string"; // Default to string for unknown types
}
