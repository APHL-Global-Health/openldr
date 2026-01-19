import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";
import { $ZodDate, extractOption } from "../../../schemaUtils";

export class DateHandler implements PrimitiveHandler {
  apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
    const zodType = schema["x-zodType"];
    if (zodType !== "date") return;

    const zodOptions = (schema["x-zodOptions"] as []) || [];
    const dateFormat = extractOption("format", zodOptions);

    if (zodOptions && zodOptions.length > 0) {
      if (types.date === undefined) {
        types.date = $ZodDate(Object.fromEntries(zodOptions));
        if (dateFormat) types.date = types.date.format(dateFormat);
      }
    }
  }
}
