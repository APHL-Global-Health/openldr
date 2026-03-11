import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { type RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

export class ObjectPropertiesHandler implements RefinementHandler {
  apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
    const objectSchema = schema as JSONSchema.ObjectSchema;

    // Skip if no object-specific constraints
    if (
      !objectSchema.properties &&
      !objectSchema.required &&
      objectSchema.additionalProperties !== false
    ) {
      return zodSchema;
    }

    // Check if the schema is a single object type (not a union)
    if (zodSchema instanceof z.ZodObject || zodSchema instanceof z.ZodRecord) {
      // Build proper shape with converted property schemas
      const shape: Record<string, z.ZodTypeAny> = {};

      if (objectSchema.properties) {
        for (const [key, propSchema] of Object.entries(
          objectSchema.properties,
        )) {
          if (propSchema !== undefined) {
            shape[key] = convertJsonSchemaToZod(propSchema);
          }
        }
      }

      // Collect property keys that have visibility conditions —
      // these should always be optional in the Zod schema because they
      // may be hidden, but we store their "originally required" status
      // in the global registry so the UI can still show them as required
      // when visible.
      const visibilityKeys = new Set<string>();
      if (objectSchema.properties) {
        for (const [key, propSchema] of Object.entries(
          objectSchema.properties,
        )) {
          if (propSchema && (propSchema as any)["x-zodVisibility"]) {
            visibilityKeys.add(key);
          }
        }
      }

      // Collect conditionally-required keys from allOf if/then blocks
      const conditionallyRequiredKeys = new Set<string>();
      if (Array.isArray((schema as any).allOf)) {
        for (const rule of (schema as any).allOf) {
          if (rule.if && rule.then?.required) {
            for (const key of rule.then.required) {
              conditionallyRequiredKeys.add(key);
            }
          }
        }
      }

      // Handle required properties
      if (objectSchema.required && Array.isArray(objectSchema.required)) {
        const required = new Set(objectSchema.required);
        for (const key of Object.keys(shape)) {
          // Fields with visibility conditions or in allOf if/then are
          // always optional in the Zod schema — validation should not
          // fail when they are hidden. Store "conditionallyRequired" in
          // the registry so the UI can still show them as required when visible.
          if (visibilityKeys.has(key) || conditionallyRequiredKeys.has(key)) {
            if (required.has(key) || conditionallyRequiredKeys.has(key)) {
              const existing = z.globalRegistry.get(shape[key] as any) ?? {};
              z.globalRegistry.add(shape[key] as any, {
                ...existing,
                conditionallyRequired: true,
              });
            }
            try {
              shape[key] = shape[key].optional();
            } catch (e) {}
          } else if (!required.has(key)) {
            try {
              shape[key] = shape[key].optional();
            } catch (e) {}
          }
        }
      } else {
        // In JSON Schema, properties are optional by default
        for (const key of Object.keys(shape)) {
          try {
            shape[key] = shape[key].optional();
          } catch (e) {}
        }
      }

      // Recreate the object with proper shape
      let result: z.ZodTypeAny;
      if (objectSchema.additionalProperties === false) {
        result = z.object(shape);
      } else {
        result = z.object(shape).passthrough();
      }

      // Add runtime validation for conditionally-required fields.
      // Evaluates allOf if/then conditions: when the `if` condition
      // matches the data, the `then.required` fields must have a value.
      if (Array.isArray((schema as any).allOf)) {
        const conditionalRules = (schema as any).allOf.filter(
          (rule: any) => rule.if && rule.then?.required,
        );
        if (conditionalRules.length > 0) {
          result = (result as z.ZodObject<any>).superRefine((data, ctx) => {
            for (const rule of conditionalRules) {
              if (matchesIfCondition(data, rule.if)) {
                for (const key of rule.then.required) {
                  const val = (data as any)[key];
                  if (val === undefined || val === null || val === "") {
                    ctx.addIssue({
                      code: "custom",
                      path: [key],
                      message: "Required",
                    });
                  }
                }
              }
            }
          });
        }
      }

      return result;
    }

    if (zodSchema.hasOwnProperty("refine")) {
      // For unions or other complex types, use refinement
      return zodSchema.refine(
        (value: any) => {
          // Only apply object constraints to objects
          if (
            typeof value !== "object" ||
            value === null ||
            Array.isArray(value)
          ) {
            return true; // Non-objects pass through
          }

          // Apply properties constraint
          if (objectSchema.properties) {
            for (const [propName, propSchema] of Object.entries(
              objectSchema.properties,
            )) {
              if (propSchema !== undefined) {
                // Use a more robust way to check if property exists
                // This handles JavaScript special property names correctly
                const propExists =
                  Object.getOwnPropertyDescriptor(value, propName) !==
                  undefined;

                if (propExists) {
                  const zodPropSchema = convertJsonSchemaToZod(propSchema);
                  const propResult = zodPropSchema.safeParse(value[propName]);
                  if (!propResult.success) {
                    return false;
                  }
                }
              }
            }
          }

          // Apply required constraint
          if (objectSchema.required && Array.isArray(objectSchema.required)) {
            for (const requiredProp of objectSchema.required) {
              // Use robust property detection for required props too
              const propExists =
                Object.getOwnPropertyDescriptor(value, requiredProp) !==
                undefined;
              if (!propExists) {
                return false;
              }
            }
          }

          // Apply additionalProperties constraint
          if (
            objectSchema.additionalProperties === false &&
            objectSchema.properties
          ) {
            const allowedProps = new Set(Object.keys(objectSchema.properties));
            for (const prop in value) {
              if (!allowedProps.has(prop)) {
                return false;
              }
            }
          }

          return true;
        },
        { message: "Object constraints validation failed" },
      );
    } else return zodSchema;
  }
}
