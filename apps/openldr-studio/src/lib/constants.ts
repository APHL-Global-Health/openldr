import { z } from "zod";
import { type LanguageConfig } from "@/types/languages";

// Set IS_PLATFORM to true if you have the api keys and urls
export const VITE_PUBLIC_IS_PLATFORM = true;

export const IS_PLATFORM = VITE_PUBLIC_IS_PLATFORM; // import.meta.env.VITE_PUBLIC_IS_PLATFORM === 'true'
export const DEFAULT_HOME = IS_PLATFORM ? "/projects" : "/project/default";
export const API_URL = IS_PLATFORM
  ? import.meta.env.VITE_PUBLIC_API_URL
  : "/api";
export const API_ADMIN_URL = IS_PLATFORM
  ? import.meta.env.VITE_PUBLIC_API_ADMIN_URL
  : undefined;
// export const PG_META_URL = IS_PLATFORM
//   ? import.meta.env.PLATFORM_PG_META_URL
//   : import.meta.env.STUDIO_PG_META_URL
export const BASE_PATH = import.meta.env.VITE_PUBLIC_BASE_PATH ?? "";

/**
 * @deprecated use DATETIME_FORMAT
 */
export const DATE_FORMAT = "YYYY-MM-DDTHH:mm:ssZ";

// should be used for all dayjs formattings shown to the user. Includes timezone info.
export const DATETIME_FORMAT = "DD MMM YYYY, HH:mm:ss (ZZ)";

export const GB = 1024 * 1024 * 1024;
export const MB = 1024 * 1024;
export const KB = 1024;

export const HIDDEN_PLACEHOLDER = "**** **** **** ****";

export const BASE_API_URL = "http://localhost:8092";

export const JOINING_VALS = [
  { key: "join_1", symbol: "and", description: "join statements with 'AND'" },
  { key: "join_2", symbol: "or", description: "join statements with 'OR'" },
  // { key: "join_3", symbol: " AND ( ", description: "join with 'AND ('" },
  // { key: "join_4", symbol: " OR ( ", description: "join with 'OR ('" },
  // { key: "join_5", symbol: " ) AND ", description: "join with ') AND'" },
  // { key: "join_6", symbol: " ) OR ", description: "join with ') OR'" },
  // { key: "join_7", symbol: " ( ", description: "open parentheses" },
  // { key: "join_8", symbol: " ) ", description: "close parentheses" },
];

export const FILTER_VALS = [
  {
    key: "op1",
    symbol: "eq",
    description: "Equal (=)",
    example: "{ age: { [Op.eq]: 25 } } (age = 25)",
  },
  {
    key: "op2",
    symbol: "ne",
    description: "Not equal (!=)",
    example: "{ age: { [Op.ne]: 25 } } (age != 25)",
  },
  {
    key: "op3",
    symbol: "gt",
    description: "Greater than (>)",
    example: "{ age: { [Op.gt]: 18 } } (age > 18)",
  },
  {
    key: "op4",
    symbol: "gte",
    description: "Greater than or equal (>=)",
    example: "{ age: { [Op.gte]: 18 } } (age >= 18)",
  },
  {
    key: "op5",
    symbol: "lt",
    description: "Less than (<)",
    example: "{ age: { [Op.lt]: 30 } } (age < 30)",
  },
  {
    key: "op6",
    symbol: "lte",
    description: "Less than or equal (<=)",
    example: "{ age: { [Op.lte]: 30 } } (age <= 30)",
  },
  {
    key: "op7",
    symbol: "between",
    description: "Between values",
    example: "{ age: { [Op.between]: [18, 30] } } (age BETWEEN 18 AND 30)",
  },
  {
    key: "op8",
    symbol: "notBetween",
    description: "Not between values",
    example:
      "{ age:{ [Op.notBetween]: [18, 30] } } (age NOT BETWEEN 18 AND 30)",
  },
  {
    key: "op9",
    symbol: "in",
    description: "Match values in array (IN)",
    example:
      "{ status: { [Op.in]: ['active', 'pending'] } } (status IN ('active', 'pending'))",
  },
  {
    key: "op10",
    symbol: "notIn",
    description: "Exclude values (NOT IN)",
    example:
      "{ status: { [Op.notIn]: ['inactive'] } } (status NOT IN ('inactive'))",
  },
  {
    key: "op11",
    symbol: "like",
    description: "Partial match (LIKE)",
    example: "{ name: { [Op.like]: '%John%' } } (name LIKE '%John%')",
  },
  {
    key: "op12",
    symbol: "notLike",
    description: "Not like (NOT LIKE)",
    example: "{ name: { [Op.notLike]: '%John%' } } (name NOT LIKE '%John%')",
  },
  {
    key: "op13",
    symbol: "iLike",
    description: "Case-insensitive LIKE (PostgreSQL)",
    example: "{ name: { [Op.iLike]: '%john%' } } (name ILIKE '%john%')",
  },
  {
    key: "op14",
    symbol: "notILike",
    description: "Case-insensitive NOT LIKE (PostgreSQL)",
    example: "{ name: { [Op.notILike]: '%john%' } } (name NOT ILIKE '%john%')",
  },
  {
    key: "op15",
    symbol: "regexp",
    description: "Regular expression (MySQL, MariaDB, PostgreSQL)",
    example: "{ name: { [Op.regexp]: '^J' } } (name REGEXP '^J')",
  },
  {
    key: "op16",
    symbol: "notRegexp",
    description: "Not matching regex",
    example: "{ name: { [Op.notRegexp]: '^J' } } (name NOT REGEXP '^J')",
  },
  {
    key: "op17",
    symbol: "is",
    description: "IS NULL / IS NOT NULL",
    example: "{ deletedAt: { [Op.is]: null } } (deletedAt IS NULL)",
  },
  {
    key: "op18",
    symbol: "or",
    description: "Logical OR",
    example:
      "{ [Op.or]: [{ firstName: 'John' }, { lastName: 'Doe' }] } (firstName = 'John' OR lastName = 'Doe')",
  },
  {
    key: "op19",
    symbol: "and",
    description: "Logical AND",
    example:
      "{ [Op.and]: [{ age: { [Op.gt]: 18 } }, { age: { [Op.lt]: 30 } }] } (age > 18 AND age < 30)",
  },
];

export const DataTypes = {
  STRING: z.union([
    z.string().trim().nullish().optional(),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  TEXT: z.union([
    z.string().trim().nullish().optional(),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  VARCHAR: z.union([
    z.string().trim().nullish().optional(),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  NVARCHAR: z.union([
    z.string().trim().nullish().optional(),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  CHAR: z.union([
    z.string().trim().nullish().optional(),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),

  INT: z.union([z.number().int(), z.literal(""), z.null(), z.undefined()]),
  INTEGER: z.union([z.number().int(), z.literal(""), z.null(), z.undefined()]),
  FLOAT: z.union([z.number(), z.literal(""), z.null(), z.undefined()]),

  BOOLEAN: z.union([
    z.boolean(),
    z.literal("true"),
    z.literal("false"),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  TINYINT: z.union([
    z.boolean(),
    z.literal("1"),
    z.literal("0"),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),

  DATE: z.union([
    z
      .string()
      .transform((val) => new Date(val))
      .nullish()
      .optional(),
    z.date().nullable().optional(),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  DATETIME: z.union([
    z
      .string()
      .transform((val) => new Date(val))
      .nullish()
      .optional(),
    z.string().datetime().nullable().optional(),
    z.date().nullable().optional(),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  TIME: z.union([z.string(), z.literal(""), z.null(), z.undefined()]), // Time is usually stored as a string (HH:mm:ss)
  DATEONLY: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]), // YYYY-MM-DD format
  UUID: z.union([z.string().uuid(), z.literal(""), z.null(), z.undefined()]),
  ENUM: z.union([z.string(), z.literal(""), z.null(), z.undefined()]), // ENUMs usually depend on predefined values
  JSON: z.union([
    z.record(z.any(), z.unknown()),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]), // JSON can be any object
  JSONB: z.union([
    z.record(z.any(), z.unknown()),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]), // JSONB is similar to JSON
  ARRAY: z.union([z.array(z.any()), z.literal(""), z.null(), z.undefined()]), // Arrays of any type
  GEOMETRY: z.union([z.string(), z.literal(""), z.null(), z.undefined()]), // Geometry usually stored as string
  GEOGRAPHY: z.union([z.string(), z.literal(""), z.null(), z.undefined()]),
  CIDR: z.union([z.string(), z.literal(""), z.null(), z.undefined()]), // CIDR notation like "192.168.1.0/24"
  INET: z.union([z.string(), z.literal(""), z.null(), z.undefined()]), // IP Address
  MACADDR: z.union([
    z.string().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]), // MAC address validation
  RANGE: z.union([z.string(), z.literal(""), z.null(), z.undefined()]), // Range formats vary
  REAL: z.union([z.number(), z.literal(""), z.null(), z.undefined()]),
  DOUBLE: z.union([z.number(), z.literal(""), z.null(), z.undefined()]),
  DECIMAL: z.union([
    z.string().regex(/^\d+(\.\d+)?$/),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]), // Decimal numbers as strings
  BIGINT: z.union([
    z.bigint(),
    z.string(),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]), // Can be stored as string or bigint
  // BLOB: z.union([z.instanceof(Buffer), z.literal(""), z.null(), z.undefined()]), // Blob data
  UUIDV1: z.union([z.string().uuid(), z.literal(""), z.null(), z.undefined()]),
  UUIDV4: z.union([z.string().uuid(), z.literal(""), z.null(), z.undefined()]),
  HSTORE: z.union([
    z.record(z.any(), z.string()),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]), // Key-value store format

  // Images
  IMAGE: z.union([
    z
      .instanceof(File)
      .refine(
        (file) =>
          ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
            file.type,
          ),
        { message: "File must be an image (JPEG, PNG, GIF, or WebP)" },
      ),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),

  // // File with specific MIME types
  // IMAGE: z.union([
  //   z.instanceof(File).refine((file) => file.type.startsWith("image/"), {
  //     message: "File must be an image",
  //   }),
  //   z.literal(""),
  //   z.null(),
  //   z.undefined(),
  // ]),

  // Documents
  DOCUMENT: z.union([
    z
      .instanceof(File)
      .refine(
        (file) =>
          [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
          ].includes(file.type),
        { message: "File must be a document (PDF, DOC, DOCX, or TXT)" },
      ),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),

  // Spreadsheets
  SPREADSHEET: z.union([
    z
      .instanceof(File)
      .refine(
        (file) =>
          [
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/csv",
          ].includes(file.type),
        { message: "File must be a spreadsheet (XLS, XLSX, or CSV)" },
      ),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),

  // Archive files
  ARCHIVE: z.union([
    z
      .instanceof(File)
      .refine(
        (file) =>
          [
            "application/zip",
            "application/x-rar-compressed",
            "application/x-7z-compressed",
          ].includes(file.type),
        { message: "File must be an archive (ZIP, RAR, or 7Z)" },
      ),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),

  // Basic file validation (works with File objects from browser)
  FILE: z.union([z.instanceof(File), z.literal(""), z.null(), z.undefined()]),

  // File with size limit (e.g., 5MB)
  LIMITED_FILE: z.union([
    z.instanceof(File).refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size must be less than 5MB",
    }),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),

  // File extension validation (from filename)
  PDF: z.union([
    z
      .instanceof(File)
      .refine((file) => file.name.toLowerCase().endsWith(".pdf"), {
        message: "File must be a PDF",
      }),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),

  // File extension validation (from filename)
  PLUGIN: z.union([
    z
      .instanceof(File)
      .refine(
        (file: any) => {
          const allowed = [".js", ".json"];
          const ext = "." + file.name.split(".").pop().toLowerCase();
          return allowed.includes(ext);
        },
        {
          message: "File must be a JavaScript (.js) or Json (.json) file",
        },
      )
      .refine(
        (file) =>
          file.type === "text/javascript" ||
          file.type === "text/json" ||
          file.type === "application/javascript" ||
          file.type === "application/json" ||
          file.type === "",
        { message: "Invalid plugin file type" },
      ),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  PLUGIN_STRICT: z
    .instanceof(File)
    .refine(
      (file: any) => {
        const allowed = [".js", ".json"];
        const ext = "." + file.name.split(".").pop().toLowerCase();
        return allowed.includes(ext);
      },
      {
        message: "File must be a JavaScript (.js) or Json (.json) file",
      },
    )
    .refine(
      (file) =>
        file.type === "text/javascript" ||
        file.type === "text/json" ||
        file.type === "application/javascript" ||
        file.type === "application/json" ||
        file.type === "",
      { message: "Invalid plugin file type" },
    ),
  // NONE: z.union([z.literal(""), z.null(), z.undefined()]), // No specific type
};

export const CountryCodes = [
  { code2: "AD", code3: "AND", name: "Andorra" },
  { code2: "AE", code3: "ARE", name: "United Arab Emirates" },
  { code2: "AF", code3: "AFG", name: "Afghanistan" },
  { code2: "AG", code3: "ATG", name: "Antigua and Barbuda" },
  { code2: "AI", code3: "AIA", name: "Anguilla" },
  { code2: "AL", code3: "ALB", name: "Albania" },
  { code2: "AM", code3: "ARM", name: "Armenia" },
  { code2: "AO", code3: "AGO", name: "Angola" },
  { code2: "AQ", code3: "ATA", name: "Antarctica" },
  { code2: "AR", code3: "ARG", name: "Argentina" },
  { code2: "AS", code3: "ASM", name: "American Samoa" },
  { code2: "AT", code3: "AUT", name: "Austria" },
  { code2: "AU", code3: "AUS", name: "Australia" },
  { code2: "AW", code3: "ABW", name: "Aruba" },
  { code2: "AX", code3: "ALA", name: "Åland Islands" },
  { code2: "AZ", code3: "AZE", name: "Azerbaijan" },
  { code2: "BA", code3: "BIH", name: "Bosnia and Herzegovina" },
  { code2: "BB", code3: "BRB", name: "Barbados" },
  { code2: "BD", code3: "BGD", name: "Bangladesh" },
  { code2: "BE", code3: "BEL", name: "Belgium" },
  { code2: "BF", code3: "BFA", name: "Burkina Faso" },
  { code2: "BG", code3: "BGR", name: "Bulgaria" },
  { code2: "BH", code3: "BHR", name: "Bahrain" },
  { code2: "BI", code3: "BDI", name: "Burundi" },
  { code2: "BJ", code3: "BEN", name: "Benin" },
  { code2: "BL", code3: "BLM", name: "Saint Barthélemy" },
  { code2: "BM", code3: "BMU", name: "Bermuda" },
  { code2: "BN", code3: "BRN", name: "Brunei Darussalam" },
  { code2: "BO", code3: "BOL", name: "Bolivia" },
  { code2: "BQ", code3: "BES", name: "Bonaire, Sint Eustatius and Saba" },
  { code2: "BR", code3: "BRA", name: "Brazil" },
  { code2: "BS", code3: "BHS", name: "Bahamas" },
  { code2: "BT", code3: "BTN", name: "Bhutan" },
  { code2: "BV", code3: "BVT", name: "Bouvet Island" },
  { code2: "BW", code3: "BWA", name: "Botswana" },
  { code2: "BY", code3: "BLR", name: "Belarus" },
  { code2: "BZ", code3: "BLZ", name: "Belize" },
  { code2: "CA", code3: "CAN", name: "Canada" },
  { code2: "CC", code3: "CCK", name: "Cocos (Keeling) Islands" },
  { code2: "CD", code3: "COD", name: "Congo, Democratic Republic of the" },
  { code2: "CF", code3: "CAF", name: "Central African Republic" },
  { code2: "CG", code3: "COG", name: "Congo" },
  { code2: "CH", code3: "CHE", name: "Switzerland" },
  { code2: "CI", code3: "CIV", name: "Côte d'Ivoire" },
  { code2: "CK", code3: "COK", name: "Cook Islands" },
  { code2: "CL", code3: "CHL", name: "Chile" },
  { code2: "CM", code3: "CMR", name: "Cameroon" },
  { code2: "CN", code3: "CHN", name: "China" },
  { code2: "CO", code3: "COL", name: "Colombia" },
  { code2: "CR", code3: "CRI", name: "Costa Rica" },
  { code2: "CU", code3: "CUB", name: "Cuba" },
  { code2: "CV", code3: "CPV", name: "Cabo Verde" },
  { code2: "CW", code3: "CUW", name: "Curaçao" },
  { code2: "CX", code3: "CXR", name: "Christmas Island" },
  { code2: "CY", code3: "CYP", name: "Cyprus" },
  { code2: "CZ", code3: "CZE", name: "Czechia" },
  { code2: "DE", code3: "DEU", name: "Germany" },
  { code2: "DJ", code3: "DJI", name: "Djibouti" },
  { code2: "DK", code3: "DNK", name: "Denmark" },
  { code2: "DM", code3: "DMA", name: "Dominica" },
  { code2: "DO", code3: "DOM", name: "Dominican Republic" },
  { code2: "DZ", code3: "DZA", name: "Algeria" },
  { code2: "EC", code3: "ECU", name: "Ecuador" },
  { code2: "EE", code3: "EST", name: "Estonia" },
  { code2: "EG", code3: "EGY", name: "Egypt" },
  { code2: "EH", code3: "ESH", name: "Western Sahara" },
  { code2: "ER", code3: "ERI", name: "Eritrea" },
  { code2: "ES", code3: "ESP", name: "Spain" },
  { code2: "ET", code3: "ETH", name: "Ethiopia" },
  { code2: "FI", code3: "FIN", name: "Finland" },
  { code2: "FJ", code3: "FJI", name: "Fiji" },
  { code2: "FK", code3: "FLK", name: "Falkland Islands (Malvinas)" },
  { code2: "FM", code3: "FSM", name: "Micronesia, Federated States of" },
  { code2: "FO", code3: "FRO", name: "Faroe Islands" },
  { code2: "FR", code3: "FRA", name: "France" },
  { code2: "GA", code3: "GAB", name: "Gabon" },
  { code2: "GB", code3: "GBR", name: "United Kingdom" },
  { code2: "GD", code3: "GRD", name: "Grenada" },
  { code2: "GE", code3: "GEO", name: "Georgia" },
  { code2: "GF", code3: "GUF", name: "French Guiana" },
  { code2: "GG", code3: "GGY", name: "Guernsey" },
  { code2: "GH", code3: "GHA", name: "Ghana" },
  { code2: "GI", code3: "GIB", name: "Gibraltar" },
  { code2: "GL", code3: "GRL", name: "Greenland" },
  { code2: "GM", code3: "GMB", name: "Gambia" },
  { code2: "GN", code3: "GIN", name: "Guinea" },
  { code2: "GP", code3: "GLP", name: "Guadeloupe" },
  { code2: "GQ", code3: "GNQ", name: "Equatorial Guinea" },
  { code2: "GR", code3: "GRC", name: "Greece" },
  {
    code2: "GS",
    code3: "SGS",
    name: "South Georgia and the South Sandwich Islands",
  },
  { code2: "GT", code3: "GTM", name: "Guatemala" },
  { code2: "GU", code3: "GUM", name: "Guam" },
  { code2: "GW", code3: "GNB", name: "Guinea-Bissau" },
  { code2: "GY", code3: "GUY", name: "Guyana" },
  { code2: "HK", code3: "HKG", name: "Hong Kong" },
  { code2: "HM", code3: "HMD", name: "Heard Island and McDonald Islands" },
  { code2: "HN", code3: "HND", name: "Honduras" },
  { code2: "HR", code3: "HRV", name: "Croatia" },
  { code2: "HT", code3: "HTI", name: "Haiti" },
  { code2: "HU", code3: "HUN", name: "Hungary" },
  { code2: "ID", code3: "IDN", name: "Indonesia" },
  { code2: "IE", code3: "IRL", name: "Ireland" },
  { code2: "IL", code3: "ISR", name: "Israel" },
  { code2: "IM", code3: "IMN", name: "Isle of Man" },
  { code2: "IN", code3: "IND", name: "India" },
  { code2: "IO", code3: "IOT", name: "British Indian Ocean Territory" },
  { code2: "IQ", code3: "IRQ", name: "Iraq" },
  { code2: "IR", code3: "IRN", name: "Iran" },
  { code2: "IS", code3: "ISL", name: "Iceland" },
  { code2: "IT", code3: "ITA", name: "Italy" },
  { code2: "JE", code3: "JEY", name: "Jersey" },
  { code2: "JM", code3: "JAM", name: "Jamaica" },
  { code2: "JO", code3: "JOR", name: "Jordan" },
  { code2: "JP", code3: "JPN", name: "Japan" },
  { code2: "KE", code3: "KEN", name: "Kenya" },
  { code2: "KG", code3: "KGZ", name: "Kyrgyzstan" },
  { code2: "KH", code3: "KHM", name: "Cambodia" },
  { code2: "KI", code3: "KIR", name: "Kiribati" },
  { code2: "KM", code3: "COM", name: "Comoros" },
  { code2: "KN", code3: "KNA", name: "Saint Kitts and Nevis" },
  { code2: "KP", code3: "PRK", name: "Korea, Democratic People's Republic of" },
  { code2: "KR", code3: "KOR", name: "Korea, Republic of" },
  { code2: "KW", code3: "KWT", name: "Kuwait" },
  { code2: "KY", code3: "CYM", name: "Cayman Islands" },
  { code2: "KZ", code3: "KAZ", name: "Kazakhstan" },
  { code2: "LA", code3: "LAO", name: "Lao People's Democratic Republic" },
  { code2: "LB", code3: "LBN", name: "Lebanon" },
  { code2: "LC", code3: "LCA", name: "Saint Lucia" },
  { code2: "LI", code3: "LIE", name: "Liechtenstein" },
  { code2: "LK", code3: "LKA", name: "Sri Lanka" },
  { code2: "LR", code3: "LBR", name: "Liberia" },
  { code2: "LS", code3: "LSO", name: "Lesotho" },
  { code2: "LT", code3: "LTU", name: "Lithuania" },
  { code2: "LU", code3: "LUX", name: "Luxembourg" },
  { code2: "LV", code3: "LVA", name: "Latvia" },
  { code2: "LY", code3: "LBY", name: "Libya" },
  { code2: "MA", code3: "MAR", name: "Morocco" },
  { code2: "MC", code3: "MCO", name: "Monaco" },
  { code2: "MD", code3: "MDA", name: "Moldova" },
  { code2: "ME", code3: "MNE", name: "Montenegro" },
  { code2: "MF", code3: "MAF", name: "Saint Martin (French part)" },
  { code2: "MG", code3: "MDG", name: "Madagascar" },
  { code2: "MH", code3: "MHL", name: "Marshall Islands" },
  { code2: "MK", code3: "MKD", name: "North Macedonia" },
  { code2: "ML", code3: "MLI", name: "Mali" },
  { code2: "MM", code3: "MMR", name: "Myanmar" },
  { code2: "MN", code3: "MNG", name: "Mongolia" },
  { code2: "MO", code3: "MAC", name: "Macao" },
  { code2: "MP", code3: "MNP", name: "Northern Mariana Islands" },
  { code2: "MQ", code3: "MTQ", name: "Martinique" },
  { code2: "MR", code3: "MRT", name: "Mauritania" },
  { code2: "MS", code3: "MSR", name: "Montserrat" },
  { code2: "MT", code3: "MLT", name: "Malta" },
  { code2: "MU", code3: "MUS", name: "Mauritius" },
  { code2: "MV", code3: "MDV", name: "Maldives" },
  { code2: "MW", code3: "MWI", name: "Malawi" },
  { code2: "MX", code3: "MEX", name: "Mexico" },
  { code2: "MY", code3: "MYS", name: "Malaysia" },
  { code2: "MZ", code3: "MOZ", name: "Mozambique" },
  { code2: "NA", code3: "NAM", name: "Namibia" },
  { code2: "NC", code3: "NCL", name: "New Caledonia" },
  { code2: "NE", code3: "NER", name: "Niger" },
  { code2: "NF", code3: "NFK", name: "Norfolk Island" },
  { code2: "NG", code3: "NGA", name: "Nigeria" },
  { code2: "NI", code3: "NIC", name: "Nicaragua" },
  { code2: "NL", code3: "NLD", name: "Netherlands" },
  { code2: "NO", code3: "NOR", name: "Norway" },
  { code2: "NP", code3: "NPL", name: "Nepal" },
  { code2: "NR", code3: "NRU", name: "Nauru" },
  { code2: "NU", code3: "NIU", name: "Niue" },
  { code2: "NZ", code3: "NZL", name: "New Zealand" },
  { code2: "OM", code3: "OMN", name: "Oman" },
  { code2: "PA", code3: "PAN", name: "Panama" },
  { code2: "PE", code3: "PER", name: "Peru" },
  { code2: "PF", code3: "PYF", name: "French Polynesia" },
  { code2: "PG", code3: "PNG", name: "Papua New Guinea" },
  { code2: "PH", code3: "PHL", name: "Philippines" },
  { code2: "PK", code3: "PAK", name: "Pakistan" },
  { code2: "PL", code3: "POL", name: "Poland" },
  { code2: "PM", code3: "SPM", name: "Saint Pierre and Miquelon" },
  { code2: "PN", code3: "PCN", name: "Pitcairn" },
  { code2: "PR", code3: "PRI", name: "Puerto Rico" },
  { code2: "PS", code3: "PSE", name: "Palestine, State of" },
  { code2: "PT", code3: "PRT", name: "Portugal" },
  { code2: "PW", code3: "PLW", name: "Palau" },
  { code2: "PY", code3: "PRY", name: "Paraguay" },
  { code2: "QA", code3: "QAT", name: "Qatar" },
  { code2: "RE", code3: "REU", name: "Réunion" },
  { code2: "RO", code3: "ROU", name: "Romania" },
  { code2: "RS", code3: "SRB", name: "Serbia" },
  { code2: "RU", code3: "RUS", name: "Russian Federation" },
  { code2: "RW", code3: "RWA", name: "Rwanda" },
  { code2: "SA", code3: "SAU", name: "Saudi Arabia" },
  { code2: "SB", code3: "SLB", name: "Solomon Islands" },
  { code2: "SC", code3: "SYC", name: "Seychelles" },
  { code2: "SD", code3: "SDN", name: "Sudan" },
  { code2: "SE", code3: "SWE", name: "Sweden" },
  { code2: "SG", code3: "SGP", name: "Singapore" },
  {
    code2: "SH",
    code3: "SHN",
    name: "Saint Helena, Ascension and Tristan da Cunha",
  },
  { code2: "SI", code3: "SVN", name: "Slovenia" },
  { code2: "SJ", code3: "SJM", name: "Svalbard and Jan Mayen" },
  { code2: "SK", code3: "SVK", name: "Slovakia" },
  { code2: "SL", code3: "SLE", name: "Sierra Leone" },
  { code2: "SM", code3: "SMR", name: "San Marino" },
  { code2: "SN", code3: "SEN", name: "Senegal" },
  { code2: "SO", code3: "SOM", name: "Somalia" },
  { code2: "SR", code3: "SUR", name: "Suriname" },
  { code2: "SS", code3: "SSD", name: "South Sudan" },
  { code2: "ST", code3: "STP", name: "Sao Tome and Principe" },
  { code2: "SV", code3: "SLV", name: "El Salvador" },
  { code2: "SX", code3: "SXM", name: "Sint Maarten (Dutch part)" },
  { code2: "SY", code3: "SYR", name: "Syrian Arab Republic" },
  { code2: "SZ", code3: "SWZ", name: "Eswatini" },
  { code2: "TC", code3: "TCA", name: "Turks and Caicos Islands" },
  { code2: "TD", code3: "TCD", name: "Chad" },
  { code2: "TF", code3: "ATF", name: "French Southern Territories" },
  { code2: "TG", code3: "TGO", name: "Togo" },
  { code2: "TH", code3: "THA", name: "Thailand" },
  { code2: "TJ", code3: "TJK", name: "Tajikistan" },
  { code2: "TK", code3: "TKL", name: "Tokelau" },
  { code2: "TL", code3: "TLS", name: "Timor-Leste" },
  { code2: "TM", code3: "TKM", name: "Turkmenistan" },
  { code2: "TN", code3: "TUN", name: "Tunisia" },
  { code2: "TO", code3: "TON", name: "Tonga" },
  { code2: "TR", code3: "TUR", name: "Turkey" },
  { code2: "TT", code3: "TTO", name: "Trinidad and Tobago" },
  { code2: "TV", code3: "TUV", name: "Tuvalu" },
  { code2: "TW", code3: "TWN", name: "Taiwan" },
  { code2: "TZ", code3: "TZA", name: "Tanzania" },
  { code2: "UA", code3: "UKR", name: "Ukraine" },
  { code2: "UG", code3: "UGA", name: "Uganda" },
  { code2: "UM", code3: "UMI", name: "United States Minor Outlying Islands" },
  { code2: "US", code3: "USA", name: "United States of America" },
  { code2: "UY", code3: "URY", name: "Uruguay" },
  { code2: "UZ", code3: "UZB", name: "Uzbekistan" },
  { code2: "VA", code3: "VAT", name: "Holy See (Vatican City State)" },
  { code2: "VC", code3: "VCT", name: "Saint Vincent and the Grenadines" },
  { code2: "VE", code3: "VEN", name: "Venezuela" },
  { code2: "VG", code3: "VGB", name: "Virgin Islands, British" },
  { code2: "VI", code3: "VIR", name: "Virgin Islands, U.S." },
  { code2: "VN", code3: "VNM", name: "Viet Nam" },
  { code2: "VU", code3: "VUT", name: "Vanuatu" },
  { code2: "WF", code3: "WLF", name: "Wallis and Futuna" },
  { code2: "WS", code3: "WSM", name: "Samoa" },
  { code2: "YE", code3: "YEM", name: "Yemen" },
  { code2: "YT", code3: "MYT", name: "Mayotte" },
  { code2: "ZA", code3: "ZAF", name: "South Africa" },
  { code2: "ZM", code3: "ZMB", name: "Zambia" },
  { code2: "ZW", code3: "ZWE", name: "Zimbabwe" },
];

export const HealthFacilityTypes = [
  { code: "101", name: "Hospital" },
  { code: "102", name: "General Hospital" },
  { code: "103", name: "Specialized Hospital" },
  { code: "104", name: "Teaching Hospital" },
  { code: "105", name: "Referral Hospital" },
  { code: "106", name: "District Hospital" },
  { code: "107", name: "Regional Hospital" },
  { code: "108", name: "National Hospital" },
  { code: "109", name: "Private Hospital" },
  { code: "110", name: "Military Hospital" },
  { code: "201", name: "Clinic" },
  { code: "202", name: "Primary Care Clinic" },
  { code: "203", name: "Outpatient Clinic" },
  { code: "204", name: "Specialty Clinic" },
  { code: "205", name: "Walk-in Clinic" },
  { code: "206", name: "Urgent Care Clinic" },
  { code: "207", name: "Family Medicine Clinic" },
  { code: "208", name: "Community Clinic" },
  { code: "209", name: "Mobile Clinic" },
  { code: "210", name: "Dental Clinic" },
  { code: "301", name: "Polyclinic" },
  { code: "302", name: "Multi-Specialty Polyclinic" },
  { code: "401", name: "Dispensary" },
  { code: "402", name: "Medical Dispensary" },
  { code: "403", name: "Pharmacy Dispensary" },
  { code: "501", name: "Health Center" },
  { code: "502", name: "Community Health Center" },
  { code: "503", name: "Primary Health Center" },
  { code: "504", name: "Rural Health Center" },
  { code: "505", name: "Urban Health Center" },
  { code: "506", name: "Maternal Health Center" },
  { code: "507", name: "Child Health Center" },
  { code: "601", name: "Health Post" },
  { code: "602", name: "Health Station" },
  { code: "603", name: "Health Outpost" },
  { code: "701", name: "Medical Center" },
  { code: "702", name: "Diagnostic Center" },
  { code: "703", name: "Imaging Center" },
  { code: "704", name: "Laboratory Center" },
  { code: "705", name: "Blood Bank" },
  { code: "706", name: "Vaccination Center" },
  { code: "707", name: "Immunization Center" },
  { code: "801", name: "Maternity Home" },
  { code: "802", name: "Birthing Center" },
  { code: "803", name: "Maternity Hospital" },
  { code: "901", name: "Mental Health Facility" },
  { code: "902", name: "Psychiatric Hospital" },
  { code: "903", name: "Rehabilitation Center" },
  { code: "904", name: "Substance Abuse Center" },
  { code: "905", name: "Counseling Center" },
  { code: "A01", name: "Emergency Medical Services" },
  { code: "A02", name: "Ambulance Service" },
  { code: "A03", name: "Emergency Room" },
  { code: "A04", name: "Trauma Center" },
  { code: "B01", name: "Nursing Home" },
  { code: "B02", name: "Assisted Living Facility" },
  { code: "B03", name: "Long-term Care Facility" },
  { code: "B04", name: "Hospice" },
  { code: "B05", name: "Palliative Care Center" },
  { code: "C01", name: "Dialysis Center" },
  { code: "C02", name: "Cancer Treatment Center" },
  { code: "C03", name: "Oncology Center" },
  { code: "C04", name: "Radiotherapy Center" },
  { code: "C05", name: "Chemotherapy Center" },
  { code: "D01", name: "Eye Care Center" },
  { code: "D02", name: "Ophthalmology Clinic" },
  { code: "D03", name: "Optometry Clinic" },
  { code: "E01", name: "Physiotherapy Center" },
  { code: "E02", name: "Physical Therapy Clinic" },
  { code: "E03", name: "Occupational Therapy Center" },
  { code: "E04", name: "Sports Medicine Clinic" },
  { code: "F01", name: "Traditional Medicine Center" },
  { code: "F02", name: "Alternative Medicine Clinic" },
  { code: "F03", name: "Herbal Medicine Center" },
  { code: "G01", name: "Mobile Health Unit" },
  { code: "G02", name: "Flying Doctor Service" },
  { code: "G03", name: "Telemedicine Center" },
  { code: "H01", name: "Research Hospital" },
  { code: "H02", name: "Medical Research Center" },
  { code: "H03", name: "Clinical Trial Center" },
  { code: "I01", name: "Medical School Clinic" },
  { code: "I02", name: "Training Hospital" },
  { code: "I03", name: "Student Health Center" },
  { code: "J01", name: "Occupational Health Center" },
  { code: "J02", name: "Industrial Health Clinic" },
  { code: "J03", name: "Workplace Health Center" },
];

//take from: https://github.com/sequelize/sequelize/blob/main/packages/core/src/operators.ts
export const Op = {
  eq: "Op.eq",
  ne: "Op.ne",
  gte: "Op.gte",
  gt: "Op.gt",
  lte: "Op.lte",
  lt: "Op.lt",
  not: "Op.not",
  is: "Op.is",
  isNot: "Op.isNot",
  in: "Op.in",
  notIn: "Op.notIn",
  like: "Op.like",
  notLike: "Op.notLike",
  iLike: "Op.iLike",
  notILike: "Op.notILike",
  startsWith: "Op.startsWith",
  notStartsWith: "Op.notStartsWith",
  endsWith: "Op.endsWith",
  notEndsWith: "Op.notEndsWith",
  substring: "Op.substring",
  notSubstring: "Op.notSubstring",
  regexp: "Op.regexp",
  notRegexp: "Op.notRegexp",
  iRegexp: "Op.iRegexp",
  notIRegexp: "Op.notIRegexp",
  between: "Op.between",
  notBetween: "Op.notBetween",
  overlap: "Op.overlap",
  contains: "Op.contains",
  contained: "Op.contained",
  adjacent: "Op.adjacent",
  strictLeft: "Op.strictLeft",
  strictRight: "Op.strictRight",
  noExtendRight: "Op.noExtendRight",
  noExtendLeft: "Op.noExtendLeft",
  and: "Op.and",
  or: "Op.or",
  any: "Op.any",
  all: "Op.all",
  values: "Op.values",
  col: "Op.col",
  match: "Op.match",
  anyKeyExists: "Op.anyKeyExists",
  allKeysExist: "Op.allKeysExist",
};

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇹🇿" },
];
