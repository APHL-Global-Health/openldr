import React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useAutoForm } from "./context";
import { getLabel, type ParsedField } from "@/lib/autoform/core";
import { ObjectField } from "./ObjectField";
import { ArrayField } from "./ArrayField";
import { type AutoFormFieldProps } from "./types";
import { getPathInObject } from "./utils";

const VISUAL_FIELD_TYPES = ["label", "separator"];

interface VisibilityCondition {
  field: string;
  operator: string;
  value?: string;
}

interface VisibilityRule {
  conditions: VisibilityCondition[];
  logic: "and" | "or";
}

function evaluateCondition(
  actual: any,
  operator: string,
  expected?: string,
): boolean {
  const str = actual == null ? "" : String(actual);
  switch (operator) {
    case "equals":
      return str === (expected ?? "");
    case "notEquals":
      return str !== (expected ?? "");
    case "contains":
      return str.includes(expected ?? "");
    case "isEmpty":
      return str === "";
    case "isNotEmpty":
      return str !== "";
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    default:
      return true;
  }
}

function evaluateVisibility(
  rule: VisibilityRule,
  watch: (name: string) => any,
): boolean {
  const results = rule.conditions.map((cond) => {
    const controlValue = watch(cond.field);
    return evaluateCondition(controlValue, cond.operator, cond.value);
  });
  return rule.logic === "and"
    ? results.every(Boolean)
    : results.some(Boolean);
}

export const AutoFormField: React.FC<{
  field: ParsedField;
  path: string[];
}> = ({ field, path }) => {
  const { formComponents, uiComponents } = useAutoForm();
  const {
    formState: { errors },
    getValues,
    watch,
  } = useFormContext();

  const fullPath = path.join(".");
  const error = getPathInObject(errors, path)?.message as string | undefined;
  const value = getValues(fullPath);

  // Evaluate visibility conditions
  const visibility = (field.fieldConfig?.customData as any)
    ?.visibility as VisibilityRule | undefined;
  if (visibility && visibility.conditions.length > 0) {
    const isVisible = evaluateVisibility(visibility, watch);
    if (!isVisible) return null;
  }

  const FieldWrapper =
    field.fieldConfig?.fieldWrapper || uiComponents.FieldWrapper;

  let FieldComponent: React.ComponentType<AutoFormFieldProps> = () => (
    <uiComponents.ErrorMessage
      error={`[AutoForm Configuration Error] No component found for type "${field.type}" nor a fallback`}
    />
  );

  if (field.type === "array") {
    FieldComponent = ArrayField;
  } else if (field.type === "object") {
    FieldComponent = ObjectField;
  } else if (field.type in formComponents) {
    FieldComponent = formComponents[field.type as keyof typeof formComponents]!;
  } else if ("fallback" in formComponents) {
    FieldComponent = formComponents.fallback;
  }

  // Visual-only fields: render without Controller/FieldWrapper
  if (VISUAL_FIELD_TYPES.includes(field.type)) {
    return (
      <FieldComponent
        label={getLabel(field)}
        field={field}
        value={undefined}
        error={undefined}
        id={fullPath}
        path={path}
        inputProps={{}}
      />
    );
  }

  return (
    <FieldWrapper
      label={getLabel(field)}
      error={error}
      id={fullPath}
      field={field}
    >
      <Controller
        name={fullPath}
        disabled={field.fieldConfig?.inputProps?.disabled}
        render={({ field: formField }) => (
          <FieldComponent
            label={getLabel(field)}
            field={field}
            value={value}
            error={error}
            id={fullPath}
            key={fullPath}
            path={path}
            inputProps={{
              error: error,
              key: `${fullPath}-input`,
              ...field.fieldConfig?.inputProps,
              ...formField,
            }}
          />
        )}
      />
    </FieldWrapper>
  );
};
