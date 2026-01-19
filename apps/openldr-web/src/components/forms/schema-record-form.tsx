import { SubmitHandler, UseFormReturn } from "react-hook-form";
import {
  useRef,
  forwardRef,
  useState,
  useEffect,
  useImperativeHandle,
} from "react";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { useQuery } from "@tanstack/react-query";
import * as DataEntryRestClient from "@/lib/restClients/dataEntryRestClient";
import { toJsonSchema, toZodSchema } from "@/lib/schemaUtils";
import { ZodProvider } from "@/lib/autoform/zod";
import { AutoForm } from "@/components/autoform";
import { useDebounce } from "use-debounce";

const SchemaRecordForm = forwardRef(
  (
    {
      value,
      data,
      onSubmit = () => {},
      onCleared,
      onError,
      onDelete,
      canSave,
    }: {
      value?: any | undefined;
      data?: any | undefined;
      onSubmit?: SubmitHandler<{ [x: string]: any }> | undefined;
      onCleared?: () => void;
      onError?: (errors: any) => void;
      onDelete?: (keys: any) => void;
      canSave?: (canSave: boolean) => void;
    },
    ref
  ) => {
    const { table, schema: version } = data || {};

    const client = useKeycloakClient();

    const formRef = useRef<HTMLFormElement>(null);
    const [form, setForm] = useState<UseFormReturn<any, any, any> | null>(null);

    const { data: entryForm } = useQuery({
      queryKey: ["Schema", "Record", "Form", table, version],
      queryFn: async () => {
        const json = await DataEntryRestClient.getForm(
          table,
          version,
          "archive",
          client.kc.token
        );

        // console.log(JSON.stringify(json));

        const _schema = toZodSchema(json);

        const schemaProvider = new ZodProvider(_schema as any);

        return {
          title: json.title,
          description: json.description,
          schema: schemaProvider,
          code: toJsonSchema(_schema),
        };
      },
      refetchInterval: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchIntervalInBackground: false,
    });

    const [debouncedFilled] = useDebounce(true, 300); // Delay updates by 300ms

    useEffect(() => {
      canSave?.(debouncedFilled);
    }, [debouncedFilled, canSave]);

    useImperativeHandle(ref, () => ({
      save: async () => {
        if (formRef.current) {
          if (formRef.current.requestSubmit) {
            formRef.current.requestSubmit();
          } else {
            if (formRef.current.reportValidity()) {
              // console.log("Form is valid");
            }
          }
        }
      },
      clear: () => {
        if (form && entryForm) {
          const keys = Object.keys(entryForm.code.properties || {});
          const defaultValues: any = {};
          keys.forEach((key) => {
            defaultValues[key] = null;
          });
          form.reset(defaultValues);
        }
      },
      delete: () => {
        const primaryKeys = (data?.columns || [])
          .filter((col: any) => col.primaryKey)
          .map((col: any) => col.id);

        const ids = primaryKeys
          .map((key: any) => {
            return value[key];
          })
          .flat();

        if (ids.length > 0) onDelete?.(ids);
      },
      clearForm: () => {
        onCleared?.();
      },
      submitForm: () => {},
    }));

    return (
      <div className="w-full h-full">
        {entryForm ? (
          <AutoForm
            values={value}
            defaultValues={value}
            onFormInit={(form: any) => {
              setForm(form);
            }}
            formProps={{
              ref: formRef,
              className:
                "grid grid-cols-[24px_auto_1fr] h-fit gap-y-2 w-[100%] px-2 py-3",
            }}
            uiComponents={{}}
            schema={entryForm.schema}
            onSubmit={(data: any, form: any) => {
              onSubmit(data);
            }}
            withSubmit={false}
          />
        ) : (
          <div> Loading form...</div>
        )}
      </div>
    );
  }
);

SchemaRecordForm.displayName = "SchemaRecordForm";

export default SchemaRecordForm;
