import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import {
  type _ZodOptions,
  type _ZodDate,
  type _ZodReference,
  type _ZodFile,
} from "../../schemaUtils";

export interface TypeSchemas {
  string?: z.ZodTypeAny | false;
  number?: z.ZodTypeAny | false;
  boolean?: z.ZodTypeAny | false;
  null?: z.ZodNull | false;
  array?: z.ZodArray<any> | false;
  tuple?: z.ZodTuple | false;
  object?: z.ZodObject<any> | _ZodOptions<any> | _ZodDate<any> | false;
  options?: _ZodOptions<any> | undefined;
  date?: _ZodDate<any> | false;
  reference?: _ZodReference<any> | false;
  file?: _ZodFile<any> | false;
}

export interface PrimitiveHandler {
  apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void;
}

export interface RefinementHandler {
  apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny;
}
