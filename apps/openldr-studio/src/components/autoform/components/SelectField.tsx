import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type AutoFormFieldProps } from "@/lib/autoform/react";
import React from "react";
import { useAutoFormListener } from "@/components/autoform-provider";
import { cn } from "@/lib/utils";

const generateRandomKey = () => {
  return Math.random().toString(36).substring(2, 10);
};

let renderKey = generateRandomKey();

export const SelectField: React.FC<AutoFormFieldProps> = ({
  field,
  value,
  inputProps,
  error,
  id,
}) => {
  const { key, ...props } = inputProps;

  useAutoFormListener("reset", () => {
    renderKey = generateRandomKey();
  });

  return (
    <Select
      key={renderKey}
      id={id}
      {...props}
      onValueChange={(value: any) => {
        const syntheticEvent = {
          target: {
            value,
            name: field.key,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        props.onChange(syntheticEvent);
      }}
      defaultValue={field.default}
      value={value}
    >
      <SelectTrigger
        id={id}
        className={cn(
          "w-full",
          error
            ? "border-destructive max-h-8 rounded-sm"
            : "max-h-8 rounded-sm",
        )}
      >
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        {(field.options || []).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
