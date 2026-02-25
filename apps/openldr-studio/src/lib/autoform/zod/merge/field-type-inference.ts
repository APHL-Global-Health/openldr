import { type FieldConfig } from "@/lib/autoform/core";
import { isZodV4Schema, type AnyZodSchema } from "../utils";
import { inferFieldType as v3InferFieldType } from "../v3/field-type-inference";
import { inferFieldType as v4InferFieldType } from "../v4/field-type-inference";

export function inferFieldType(
  schema: AnyZodSchema,
  fieldConfig?: FieldConfig,
): string {
  if (isZodV4Schema(schema)) {
    return v4InferFieldType(schema, fieldConfig);
  }
  return v3InferFieldType(schema, fieldConfig);
}
