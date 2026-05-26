import { Separator } from "@/components/ui/separator";
import { type AutoFormFieldProps } from "@/lib/autoform/react";
import React from "react";

export const SeparatorField: React.FC<AutoFormFieldProps> = () => {
  return <Separator className="my-2" />;
};
