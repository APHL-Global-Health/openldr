import type { JSONSchema } from "zod/v4/core";
import { type PrimitiveHandler, type TypeSchemas } from "../../core/types";
import { $ZodSeparator } from "../../../schemaUtils";

export class SeparatorHandler implements PrimitiveHandler {
  apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
    if (schema["x-zodType"] !== "separator") return;

    if (types.separator === undefined) {
      types.separator = $ZodSeparator();
    }
  }
}
