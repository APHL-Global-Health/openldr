import { Input } from "@/components/ui/input";
import { AutoFormFieldProps } from "@/lib/autoform/react";
import React from "react";

function stringifyIfObject(value) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

export const StringField: React.FC<AutoFormFieldProps> = ({
  inputProps,
  field,
  error,
  id,
}) => {
  const { key, ...props } = inputProps;
  props.value = stringifyIfObject(props.value);

  return (
    <Input
      id={id}
      key={key}
      className={
        error
          ? "border-destructive max-h-[32px] rounded-[4px]"
          : "max-h-[32px] rounded-[4px]"
      }
      {...props}
      onChanged={(val: any) => {
        const event = {
          target: {
            name: field.key,
            value: val,
          },
        };
        inputProps.onChange(event);
      }}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck="false"
    />
  );
};
