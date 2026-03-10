import type { JSONSchema } from "zod/v4/core";
import { type PrimitiveHandler, type TypeSchemas } from "../../core/types";
import { $ZodLabel } from "../../../schemaUtils";

export class LabelHandler implements PrimitiveHandler {
  apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
    if (schema["x-zodType"] !== "label") return;

    const labelData = (schema["x-zodLabel"] as { text: string; variant: string }) ?? {
      text: "",
      variant: "h3",
    };

    if (types.label === undefined) {
      types.label = $ZodLabel(labelData);
    }
  }
}
