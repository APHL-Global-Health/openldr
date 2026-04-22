import type { JSONSchema } from "zod/v4/core";
import { type PrimitiveHandler, type TypeSchemas } from "../../core/types";
import { $ZodFile, type ZodFileType } from "../../../schemaUtils";

export class FileHandler implements PrimitiveHandler {
  apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
    const zodType = schema["x-zodType"];
    if (zodType !== "file") return;

    const zodFile = schema["x-zodFile"] as ZodFileType | undefined;

    if (zodFile) {
      if (types.file === undefined) {
        types.file = $ZodFile(zodFile);
      }
    }
  }
}
