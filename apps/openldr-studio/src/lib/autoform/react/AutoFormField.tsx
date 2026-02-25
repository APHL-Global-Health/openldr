import React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useAutoForm } from "./context";
import { getLabel, type ParsedField } from "@/lib/autoform/core";
import { ObjectField } from "./ObjectField";
import { ArrayField } from "./ArrayField";
import { type AutoFormFieldProps } from "./types";
import { getPathInObject } from "./utils";

export const AutoFormField: React.FC<{
  field: ParsedField;
  path: string[];
}> = ({ field, path }) => {
  const { formComponents, uiComponents } = useAutoForm();
  const {
    formState: { errors },
    getValues,
  } = useFormContext();

  const fullPath = path.join(".");
  const error = getPathInObject(errors, path)?.message as string | undefined;
  const value = getValues(fullPath);

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
