import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";
import { $ZodOptions } from "../../../schemaUtils";

export class OptionsHandler implements PrimitiveHandler {
  apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
    const zodType = schema["x-zodType"];
    if (zodType !== "options") return;

    const zodOptions = (schema["x-zodOptions"] as []) || [];

    if (zodOptions && zodOptions.length > 0) {
      if (types.options === undefined) {
        types.options = $ZodOptions(Object.fromEntries(zodOptions));
      }
    }
  }
}
