export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "options"
  | "reference"
  | "file"
  | "label"
  | "separator"
  | "textarea";

export interface ValidationRule {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface DateConfig {
  format: string; // e.g. "yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss"
}

export interface OptionsConfig {
  entries: [string, string][]; // [value, label] pairs
}

export interface ReferenceConfig {
  table: string;
  key: string;
  attributes: string[];
}

export interface FileConfig {
  mimes: string[];
}

export interface StringConfig {
  format?: "uuid" | "email" | "url" | "";
}

export interface NumberConfig {
  exclusiveMin?: number;
  exclusiveMax?: number;
  multipleOf?: number;
}

export interface LabelConfig {
  text: string;
  variant: "h1" | "h2" | "h3" | "body" | "muted";
}

export interface VisibilityCondition {
  field: string; // key of the controlling field
  operator:
    | "equals"
    | "notEquals"
    | "contains"
    | "isEmpty"
    | "isNotEmpty"
    | "gt"
    | "lt";
  value?: string; // not needed for isEmpty/isNotEmpty
}

export interface VisibilityRule {
  conditions: VisibilityCondition[];
  logic: "and" | "or";
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  key: string;
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: string; // comma-separated for select
  defaultValue?: string;
  validation?: ValidationRule;
  expanded: boolean;

  // Type-specific configs
  dateConfig?: DateConfig;
  optionsConfig?: OptionsConfig;
  referenceConfig?: ReferenceConfig;
  fileConfig?: FileConfig;
  stringConfig?: StringConfig;
  numberConfig?: NumberConfig;
  labelConfig?: LabelConfig;

  // Conditional visibility
  visibility?: VisibilityRule;

  /** Original JSON Schema property preserved for round-tripping */
  _schemaProperty?: Record<string, any>;
}

export interface FormDefinition {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  createdAt: number;
  updatedAt: number;
}

export interface JSONSchema {
  $schema?: string;
  title?: string;
  description?: string;
  type: string;
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface JSONSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  format?: string;
  enum?: string[];
  items?: { type: string };
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
  "x-zodType"?: string;
  "x-zodOptions"?: [string, string][];
  "x-zodReference"?: { table: string; key: string; attributes: string[] };
  "x-zodFile"?: {
    file: string;
    key: string;
    content: string;
    mimes: string[];
  };
  "x-zodLabel"?: { text: string; variant: string };
  "x-zodVisibility"?: {
    conditions: VisibilityCondition[];
    logic: "and" | "or";
  };
  [key: string]: unknown;
}

export type TabId = "builder" | "preview" | "schema";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  icon: string;
  color: string;
  description: string;
  category?: "data" | "layout";
}
