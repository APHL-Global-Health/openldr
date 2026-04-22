// import { z } from "zod";
// import { convertJsonSchemaToZod } from "./zod-from-json-schema";
import * as z from "zod/v4/core";
import { format } from "date-fns";

export type OptionsLike = {
  [k: string]: string | number;
  [nu: number]: string;
};

export interface $ZodOptionsDef<T extends OptionsLike = OptionsLike>
  extends z.$ZodTypeDef {
  type: "enum";
  entries: T;
}

export type $InferOptionsOutput<T extends OptionsLike> = T[keyof T] & {};

export interface $ZodOptionsInternals<
  /** @ts-ignore Cast variance */
  out T extends OptionsLike = OptionsLike,
> extends z.$ZodTypeInternals<$InferOptionsOutput<T>, $InferOptionsOutput<T>> {
  option: T;
  def: $ZodOptionsDef<T>;
}

export interface _ZodOptions<T extends OptionsLike = OptionsLike>
  extends z.$ZodType {
  _zod: $ZodOptionsInternals<T>;
}

export const ZodOptions: z.$constructor<_ZodOptions> = z.$constructor(
  "ZodOptions",
  (inst, def) => {
    (z.$ZodType.init as any)(inst, def);

    inst._zod.parse = (
      payload: z.ParsePayload<any>,
      _ctx: z.ParseContextInternal
    ): z.util.MaybeAsync<z.ParsePayload> => {
      //TODO validate later
      return payload;
    };
  }
);

export const $ZodOptions = <T extends OptionsLike>(
  entries: T,
  params?: any
) => {
  return new ZodOptions({
    type: "enum",
    entries,
    ...z.util.normalizeParams(params),
  });
};

//ZodDate
export interface _ZodDate<T extends z.$ZodDateInternals = z.$ZodDateInternals>
  extends z.$ZodType<T> {
  min(
    value: number | Date,
    params?: string | z.$ZodCheckGreaterThanParams
  ): this;
  max(value: number | Date, params?: string | z.$ZodCheckLessThanParams): this;

  format(pattern: string | RegExp): this;
  // dateFormat: string | RegExp | null;
  dateFormat: string | null;

  /** @deprecated Not recommended. */
  minDate: Date | null;
  /** @deprecated Not recommended. */
  maxDate: Date | null;
}

export interface ZodDate extends _ZodDate<z.$ZodDateInternals<Date>> {}
export const ZodDate: z.$constructor<ZodDate> = /*@__PURE__*/ z.$constructor(
  "ZodDate",
  (inst, def) => {
    (z.$ZodDate.init as any)(inst, def);
    (z.$ZodType.init as any)(inst, def);

    inst._zod.parse = (
      payload: z.ParsePayload<any>,
      _ctx: z.ParseContextInternal
    ): z.util.MaybeAsync<z.ParsePayload> => {
      //TODO validate later
      // console.log(payload, ctx, inst.dateFormat);

      const date = new Date(payload.value);
      if (isNaN(date.getTime())) {
        // Need to fix this later: addIssue does not exist in ctx
        // ctx.addIssue({
        //   code: "Invalid date",
        //   message: "Invalid date",
        // });
      }

      if (inst.dateFormat != null) {
        if (typeof inst.dateFormat === "string") {
          return {
            ...payload,
            value: format(date, inst.dateFormat),
          };
        } /*else if (inst.dateFormat instanceof RegExp) {
          const regex = inst.dateFormat;
          const dateString = date.toISOString();
          const match = dateString.match(regex);
          if (match) {
            const [, year, month, day, hour, minute, second] = match;
            return {
              ...payload,
              value: `${year}-${month}-${day} ${hour}:${minute}:${second}`,
            };
          }
        }*/
      }

      return payload;
    };

    inst.dateFormat = "yyyy-MM-dd hh:mm:ss";

    //inst.format = (pattern: string | RegExp) => {
    inst.format = (pattern: string) => {
      inst.dateFormat = pattern;
      return inst;
    };

    // inst.min = (value, params) => inst.check(checks.gte(value, params));
    // inst.max = (value, params) => inst.check(checks.lte(value, params));

    // const c = inst._zod.bag;
    // inst.minDate = c.minimum ? new Date(c.minimum) : null;
    // inst.maxDate = c.maximum ? new Date(c.maximum) : null;
  }
);

export function $ZodDate(params?: string | z.$ZodDateParams): ZodDate {
  return new ZodDate({
    type: "date",
    ...z.util.normalizeParams(params),
  });
}

export const toJsonSchema = (zodSchema: any) => {
  return z.toJSONSchema(zodSchema, {
    unrepresentable: "any",
    override: (ctx) => {
      const def = ctx.zodSchema._zod.def;
      // const path = ctx.path;
      // const fieldName = path[path.length - 1];

      //Array
      if (def.type === "enum") {
        delete ctx.jsonSchema.enum;
        ctx.jsonSchema.type = "object";
        ctx.jsonSchema["x-zodType"] = "options";
        ctx.jsonSchema["x-zodOptions"] = Object.entries(def.entries);
      }
      //Date
      else if (def.type === "date") {
        const dateFormat = (ctx.zodSchema as any).dateFormat;

        ctx.jsonSchema.type = "object";
        //date-time, date, time, duration
        ctx.jsonSchema.format = "date-time";
        ctx.jsonSchema["x-zodType"] = "date";
        if (dateFormat)
          ctx.jsonSchema["x-zodOptions"] = [["format", dateFormat]];
      }
    },
  });
};

// export const toZodSchema = (jsonSchema: any) => {
//   return convertJsonSchemaToZod(jsonSchema);
// };

export const extractOption = (
  key: string,
  options: [string, string][] | undefined
) => {
  if (options) {
    return options.find((t) => {
      if (Array.isArray(t) && t.length == 2) {
        return t[0] === key;
      }
      return false;
    })?.[1];
  }
  return undefined;
};
