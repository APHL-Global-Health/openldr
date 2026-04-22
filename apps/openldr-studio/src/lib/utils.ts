import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DataTypes } from "@/lib/constants";
import { z } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: any, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
export const noop = () => {};

export function on<T extends Window | Document | HTMLElement | EventTarget>(
  obj: T | null,
  ...args: Parameters<T["addEventListener"]> | [string, Function | null, ...any]
): void {
  if (obj && obj.addEventListener) {
    obj.addEventListener(
      ...(args as Parameters<HTMLElement["addEventListener"]>),
    );
  }
}

export function off<T extends Window | Document | HTMLElement | EventTarget>(
  obj: T | null,
  ...args:
    | Parameters<T["removeEventListener"]>
    | [string, Function | null, ...any]
): void {
  if (obj && obj.removeEventListener) {
    obj.removeEventListener(
      ...(args as Parameters<HTMLElement["removeEventListener"]>),
    );
  }
}

export const isBrowser = typeof window !== "undefined";

export const isNavigator = typeof navigator !== "undefined";

export const getDataTypes = (
  fieldType: string,
  strictMode: boolean = false,
  constraint: number | undefined | null = undefined,
) => {
  const types = Object.keys(DataTypes);
  if (fieldType) {
    const type = types.find((type) => type === fieldType.toUpperCase());
    if (!type) {
      throw new Error(`${fieldType} is not a valid data type`);
    }

    if (
      type === "STRING" ||
      type === "TEXT" ||
      type === "VARCHAR" ||
      type === "NVARCHAR" ||
      type === "CHAR"
    ) {
      if (strictMode) {
        if (constraint) return z.string().max(constraint).trim();
        else return z.string().trim().min(1, "Required");
      }

      let type = z.string().trim().nullish().optional();
      if (constraint)
        type = z.string().max(constraint).trim().nullish().optional();

      return z.union([type, z.literal(""), z.null(), z.undefined()]).optional();
    } else if (type === "INT" || type === "INTEGER") {
      if (strictMode) {
        if (constraint) return z.number().int().max(constraint);
        else return z.number().int();
      }

      let type = z.number().int();
      if (constraint) type = z.number().int().max(constraint);

      return z
        .union([type, z.literal(""), z.literal(NaN)])
        .nullable()
        .optional();
    } else if (type === "PLUGIN") {
      if (strictMode) return DataTypes.PLUGIN_STRICT;
      else return DataTypes.PLUGIN;
    } else if (type === "BOOLEAN") {
      if (strictMode)
        return z.union([z.boolean(), z.literal("true"), z.literal("false")]);
      else return DataTypes.BOOLEAN.nullable().optional();
    } else if (type === "TINYINT") {
      if (strictMode) {
        if (constraint) {
          if (constraint === 1) {
            return z.union([z.boolean(), z.literal("1"), z.literal("0")]);
          }
          return z.number().max(constraint);
        } else return z.number();
      }

      if (constraint && constraint > 1) return z.number().max(constraint);

      return z
        .union([
          z.boolean(),
          z.literal("1"),
          z.literal("0"),
          z.literal(""),
          z.null(),
          z.undefined(),
        ])
        .optional();
    } else if (type === "DATE") {
      return DataTypes.DATE.nullable().optional();
    } else if (type === "DATETIME") {
      return DataTypes.DATE.nullable().optional();
    } else if (type === "TIME") {
      return DataTypes.DATE.nullable().optional();
    } else if (type === "DATEONLY") {
      return DataTypes.DATE.nullable().optional();
    } else if (type === "UUID") {
      return DataTypes.STRING.nullable().optional();
    } else if (type === "ENUM") {
      return DataTypes.STRING.nullable().optional();
    } else if (type === "JSON") {
      return DataTypes.JSON.nullable().optional();
    } else if (type === "JSONB") {
      return DataTypes.JSON.nullable().optional();
    } else if (type === "ARRAY") {
      return DataTypes.ARRAY.nullable().optional();
    } else if (type === "GEOMETRY") {
      return DataTypes.STRING.nullable().optional();
    } else if (type === "GEOGRAPHY") {
      return DataTypes.STRING.nullable().optional();
    } else if (type === "CIDR") {
      return DataTypes.STRING.nullable().optional();
    } else if (type === "INET") {
      return DataTypes.STRING.nullable().optional();
    } else if (type === "MACADDR") {
      return DataTypes.STRING.nullable().optional();
    } else if (type === "RANGE") {
      return DataTypes.STRING.nullable().optional();
    } else if (
      type === "REAL" ||
      type === "DOUBLE" ||
      type === "DECIMAL" ||
      type === "BIGINT" ||
      type === "FLOAT" ||
      type === "NUMBER"
    ) {
      if (strictMode) {
        if (constraint) return z.number().max(constraint);
        else return z.number();
      }

      let type = z.number();
      if (constraint) type = z.number().max(constraint);

      return z
        .union([type, z.literal(""), z.literal(NaN)])
        .nullable()
        .optional();
    } else if (type === "BLOB") {
      return DataTypes.STRING.nullable().optional();
    } else if (type === "UUIDV1") {
      return DataTypes.UUIDV1.nullable().optional();
    } else if (type === "UUIDV4") {
      return DataTypes.UUIDV4.nullable().optional();
    } else if (type === "HSTORE") {
      return DataTypes.HSTORE.nullable().optional();
    }
  }

  //retrun string if no type is provided
  return DataTypes.STRING.nullable().optional();
};

export const createSchema = (item: any, columns: any[]) => {
  if (item === null || item === undefined) return z.object({});

  return z.object(
    Object.keys(item).reduce(
      (acc, key) => {
        const column = (columns || []).find((column) => column.id === key);
        if (column) {
          const fieldType = column.type.toUpperCase();
          acc[key] = getDataTypes(
            fieldType,
            column.primaryKey || column.nullable === false,
            column.constraint,
          );
        } else {
          acc[key] = DataTypes.STRING.optional();
        }
        return acc;
      },
      {} as Record<string, any>,
    ),
  );
};

export const capitalizeFirst = (str: string) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Extracts a value from a nested object using dot notation
 * @param obj - The object to query
 * @param path - The dot-separated path to the desired value (e.g., "facility.facilityName")
 * @returns The value at the specified path, or undefined if not found
 */
export function getNestedValue<T = any>(obj: any, path: string): T | undefined {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return undefined;
    }
    current = current[key];
  }

  return current as T;
}

/**
 * Type-safe version for your specific data structure
 */
export function queryDataFeed<T = any>(obj: any, path: string): T | undefined {
  return getNestedValue<T>(obj, path);
}

export const createUUIDv7 = () => {
  const timestamp = BigInt(Date.now());
  const timestampHi = Number(timestamp >> 16n) & 0xffffffff;
  const timestampLo = Number(timestamp & 0xffffn);

  const randomBytes = new Uint32Array(3);
  crypto.getRandomValues(randomBytes);

  // Format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
  const uuid = [
    timestampHi.toString(16).padStart(8, "0"),
    ((timestampLo << 4) | (randomBytes[0] >> 28)).toString(16).padStart(4, "0"),
    (0x7000 | ((randomBytes[0] >> 16) & 0x0fff)).toString(16),
    (0x8000 | ((randomBytes[0] >> 2) & 0x3fff)).toString(16),
    (((randomBytes[0] & 0x03) << 30) | (randomBytes[1] >> 2))
      .toString(16)
      .padStart(8, "0"),
    (((randomBytes[1] & 0x03) << 30) | (randomBytes[2] >> 2))
      .toString(16)
      .padStart(8, "0"),
  ];

  return `${uuid[0]}-${uuid[1]}-${uuid[2]}-${uuid[3]}-${uuid[4]}${uuid[5]}`;
};

export const formatDate = (date: Date, formatString: string) => {
  const tokens = {
    yyyy: date.getFullYear(),
    MM: String(date.getMonth() + 1).padStart(2, "0"),
    dd: String(date.getDate()).padStart(2, "0"),
    HH: String(date.getHours()).padStart(2, "0"),
    mm: String(date.getMinutes()).padStart(2, "0"),
    ss: String(date.getSeconds()).padStart(2, "0"),
  };

  let result = formatString;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(token, "g"), value.toString());
  }
  return result;
};

export const getValidOptionValues = (obj: any): any[] => {
  const validKeys = objectKeys(obj).filter(
    (k: any) => typeof obj[obj[k]] !== "number",
  );
  const filtered: any = {};
  for (const k of validKeys) {
    filtered[k] = k; //obj[k];
  }
  return objectValues(filtered);
};

export const objectValues = (obj: any): any[] => {
  return objectKeys(obj).map(function (e) {
    return obj[e];
  });
};

export const objectKeys: ObjectConstructor["keys"] =
  typeof Object.keys === "function"
    ? (obj: any) => Object.keys(obj)
    : (object: any) => {
        const keys: any = [];
        for (const key in object) {
          if (Object.prototype.hasOwnProperty.call(object, key)) {
            keys.push(key);
          }
        }
        return keys;
      };

export const generateRandomKey = () => {
  return Math.random().toString(36).substring(2, 10);
};
