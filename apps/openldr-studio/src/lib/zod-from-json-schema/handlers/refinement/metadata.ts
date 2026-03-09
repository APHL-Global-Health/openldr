import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { type RefinementHandler } from "../../core/types";

export class MetadataHandler implements RefinementHandler {
  apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
    if (schema.description) {
      zodSchema = zodSchema.describe(schema.description);
    }
    if ((schema as any).readOnly === true) {
      const existing = z.globalRegistry.get(zodSchema as any) ?? {};
      z.globalRegistry.add(zodSchema as any, { ...existing, readOnly: true });
    }
    return zodSchema;
  }
}
