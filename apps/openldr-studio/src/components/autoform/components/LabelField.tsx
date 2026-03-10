import { type AutoFormFieldProps } from "@/lib/autoform/react";
import React from "react";

export const LabelField: React.FC<AutoFormFieldProps> = ({ field }) => {
  const labelData = (field.fieldConfig?.customData as any)?.labelData as
    | { text: string; variant: string }
    | undefined;

  const text = labelData?.text || field.description || field.key || "";
  const variant = labelData?.variant || "h3";

  const variantClasses: Record<string, string> = {
    h1: "text-2xl font-bold",
    h2: "text-xl font-semibold",
    h3: "text-lg font-semibold",
    body: "text-sm",
    muted: "text-sm text-muted-foreground",
  };

  return (
    <div className={variantClasses[variant] ?? variantClasses.h3}>
      {text}
    </div>
  );
};
