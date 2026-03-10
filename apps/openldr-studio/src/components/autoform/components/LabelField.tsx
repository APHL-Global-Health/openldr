import { type AutoFormFieldProps } from "@/lib/autoform/react";
import React from "react";

export const LabelField: React.FC<AutoFormFieldProps> = ({ field }) => {
  const options = field.options as any;
  // Label data is stored in the field's options via the schema parser
  // or directly from the x-zodLabel config
  const labelDef = (field as any)._zod?.def?.label ?? {};
  const text = labelDef.text || field.key || "";
  const variant = labelDef.variant || "h3";

  // Also check if text/variant came through via description or label
  const displayText = text || (field as any).description || field.key;

  const variantClasses: Record<string, string> = {
    h1: "text-2xl font-bold",
    h2: "text-xl font-semibold",
    h3: "text-lg font-semibold",
    body: "text-sm",
    muted: "text-sm text-muted-foreground",
  };

  return (
    <div className={variantClasses[variant] ?? variantClasses.h3}>
      {displayText}
    </div>
  );
};
