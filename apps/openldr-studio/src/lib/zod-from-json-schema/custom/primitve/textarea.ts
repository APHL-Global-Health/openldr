import * as z from "zod/v4/core";
import type { JSONSchema } from "zod/v4/core";
import { type PrimitiveHandler, type TypeSchemas } from "../../core/types";

export class TextareaHandler implements PrimitiveHandler {
  apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
    if (schema["x-zodType"] !== "textarea") return;

    // Textarea is a string type — create a z.string() and tag it via globalRegistry
    // so field-type-inference can detect it via fieldConfig.fieldType
    const str = z.string();
    z.globalRegistry.add(str, { fieldType: "textarea" } as any);
    types.string = str;
  }
}
