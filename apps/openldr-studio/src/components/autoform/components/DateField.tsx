import { type AutoFormFieldProps } from "@/lib/autoform/react";
import React from "react";
import { DateTimeInput } from "@/components/datetime/datetime-input";
import { cn } from "@/lib/utils";
import { formatDate, generateRandomKey } from "@/lib/utils";
import { useAutoFormListener } from "@/components/autoform-provider";
import { extractOption } from "@/lib/schemaUtils";

let renderKey = generateRandomKey();

export const DateField: React.FC<AutoFormFieldProps> = ({
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

  let format = "yyyy-MM-dd HH:mm";
  const dateFormat = extractOption("format", field.options);
  if (dateFormat) format = dateFormat;

  return (
    <DateTimeInput
      defaultValue={field.default}
      value={value}
      id={id}
      key={renderKey}
      onChanged={(val: any) => {
        const event = {
          target: {
            name: field.key,
            value: val ? formatDate(val, format) : null,
          },
        };
        inputProps.onChange(event);
      }}
      {...props}
      hideCalendarIcon={true}
      className={cn(
        "flex px-3 py-2 w-full text-sm max-h-8 rounded-sm",
        error ? "border-destructive" : "",
      )}
      format={format}
    />
  );
};
