import { type ExtendableAutoFormProps } from "@/lib/autoform/react";
import { type FieldValues } from "react-hook-form";

export interface AutoFormProps<
  T extends FieldValues,
> extends ExtendableAutoFormProps<T> {}
