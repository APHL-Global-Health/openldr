import React from "react";
import { AutoFormFieldProps } from "@/lib/autoform/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useController } from "react-hook-form";

const values = [
  { label: "True", value: "true" },
  { label: "False", value: "false" },
];

export const BooleanField: React.FC<AutoFormFieldProps> = ({
  field,
  value,
  id,
  inputProps,
}) => {
  const { key, onChange, onBlur, ref, ...props } = inputProps;
  const { field: formField } = useController({ name: id });

  return (
    <Select
      // onValueChange={formField.onChange}
      onValueChange={(v: any) => {
        const event = {
          target: {
            name: field.key,
            value: v === "true" ? true : false,
          },
        };
        inputProps.onChange(event);
      }}
      value={formField.value?.toString()}
      // {...props}
    >
      <SelectTrigger
        id={id}
        {...formField}
        className="flex flex-1 b-0 max-h-8 rounded-sm"
      >
        <SelectValue placeholder="" />
      </SelectTrigger>
      <SelectContent>
        {values.map((value) => (
          <SelectItem key={`${id}_${value.label}_items`} value={value.value}>
            {value.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
