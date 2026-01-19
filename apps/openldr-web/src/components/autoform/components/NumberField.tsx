import { Input } from "@/components/ui/input";
import { AutoFormFieldProps } from "@/lib/autoform/react";
import React from "react";

export const NumberField: React.FC<AutoFormFieldProps> = ({
  inputProps,
  error,
  id,
}) => {
  const { key, ...props } = inputProps;

  return (
    <Input
      id={id}
      type="number"
      className={
        error
          ? "border-destructive max-h-[32px] rounded-[4px]"
          : "max-h-[32px] rounded-[4px]"
      }
      {...props}
    />
  );
};
