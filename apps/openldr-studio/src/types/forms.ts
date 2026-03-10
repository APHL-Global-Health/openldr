export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "options"
  | "reference"
  | "file";

export interface ValidationRule {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  key: string;
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: string; // comma-separated for select/multiselect
  defaultValue?: string;
  validation?: ValidationRule;
  expanded: boolean;
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
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  enum?: string[];
  items?: { type: string };
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
}

export type TabId = "builder" | "preview" | "schema";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  icon: string;
  color: string;
  description: string;
}
