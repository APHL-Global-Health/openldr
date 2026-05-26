import { Textarea } from "@/components/ui/textarea";
import { type AutoFormFieldProps } from "@/lib/autoform/react";
import React from "react";

export const TextareaField: React.FC<AutoFormFieldProps> = ({
  inputProps,
  error,
  id,
}) => {
  const { key, ...props } = inputProps;

  return (
    <Textarea
      id={id}
      key={key}
      className={error ? "border-destructive rounded-sm" : "rounded-sm"}
      rows={4}
      {...props}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck="false"
    />
  );
};
