import {
  AutoForm as BaseAutoForm,
  AutoFormUIComponents,
} from "@/lib/autoform/react";
import { AutoFormProps } from "./types";
import { Form } from "@/components/autoform/components/Form";
import { FieldWrapper } from "@/components/autoform/components/FieldWrapper";
import { ErrorMessage } from "@/components/autoform/components/ErrorMessage";
import { SubmitButton } from "@/components/autoform/components/SubmitButton";
import { StringField } from "@/components/autoform/components/StringField";
import { NumberField } from "@/components/autoform/components/NumberField";
import { BooleanField } from "@/components/autoform/components/BooleanField";
import { DateField } from "@/components/autoform/components/DateField";
import { SelectField } from "@/components/autoform/components/SelectField";
import { ObjectWrapper } from "@/components/autoform/components/ObjectWrapper";
import { ArrayWrapper } from "@/components/autoform/components/ArrayWrapper";
import { ArrayElementWrapper } from "@/components/autoform/components/ArrayElementWrapper";
import { ReferenceField } from "@/components/autoform/components/ReferenceField";
import { FileField } from "@/components/autoform/components/FileField";

const ShadcnUIComponents: AutoFormUIComponents = {
  Form,
  FieldWrapper,
  ErrorMessage,
  SubmitButton,
  ObjectWrapper,
  ArrayWrapper,
  ArrayElementWrapper,
};

export const ShadcnAutoFormFieldComponents = {
  string: StringField,
  number: NumberField,
  boolean: BooleanField,
  date: DateField,
  select: SelectField,
  options: SelectField,
  reference: ReferenceField,
  file: FileField,
} as const;
export type FieldTypes = keyof typeof ShadcnAutoFormFieldComponents;

export function AutoForm<T extends Record<string, any>>({
  uiComponents,
  formComponents,
  ...props
}: AutoFormProps<T>) {
  return (
    <BaseAutoForm
      {...props}
      uiComponents={{ ...ShadcnUIComponents, ...uiComponents }}
      formComponents={{ ...ShadcnAutoFormFieldComponents, ...formComponents }}
    />
  );
}
