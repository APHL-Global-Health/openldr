import type { JSONSchema } from "zod/v4/core";
import { type PrimitiveHandler, type TypeSchemas } from "../../core/types";
import { $ZodReference, type ZodRefType } from "../../../schemaUtils";

export class ReferenceHandler implements PrimitiveHandler {
  apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
    const zodType = schema["x-zodType"];
    if (zodType !== "reference") return;

    const zodReference = schema["x-zodReference"] as ZodRefType | undefined;

    if (zodReference) {
      if (types.reference === undefined) {
        types.reference = $ZodReference(zodReference);
      }
    }
  }
}
