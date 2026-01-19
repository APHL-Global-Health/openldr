import { Input } from "@/components/ui/input";
import { AutoFormFieldProps } from "@/lib/autoform/react";
import React, { useRef, useState } from "react";
import { extractOption } from "@/lib/schemaUtils";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { UploadIcon } from "lucide-react";
import { z } from "zod";

export const FileField: React.FC<AutoFormFieldProps> = ({
  field,
  value,
  inputProps,
  error,
  id,
}) => {
  const [updated, setUpdated] = useState(false);

  const { key, ...props } = inputProps;

  const inputRef = useRef<HTMLInputElement>(null);

  const file = extractOption("file", field.options) as any;
  let mimes = "";
  if (file && file.mimes && Array.isArray(file.mimes)) {
    mimes = file.mimes.join(",");
  }

  let valueString = "";
  if (value && !updated) {
    if (typeof value === "string") {
      valueString = value.split("/").pop() || "";
    }
    if (inputRef.current) {
      inputRef.current.value = valueString;
    }
  }

  return (
    <div className="flex border rounded-sm w-full flex-row items-center p-0">
      <Label className="text-sm font-medium text-heading px-4">File</Label>
      <Input
        id={id}
        className="hidden"
        type="file"
        accept={mimes}
        onChange={(e) => {
          const f = e.target.files?.[0];

          if (!f && inputRef.current) {
            inputRef.current.value = "";
            return;
          }

          const parser = z.union([
            z.instanceof(File).refine(
              (item: any) => {
                const allowed = file.mimes;
                const ext = "." + item.name.split(".").pop().toLowerCase();
                return allowed.includes(ext);
              },
              {
                message: "File must be an allowed type",
              }
            ),
          ]);

          try {
            parser.parse(f);
            if (f && inputRef.current) {
              const reader = new FileReader();

              reader.onload = (ev: any) => {
                setUpdated(true);

                const event = {
                  target: {
                    name: field.key,
                    value: {
                      name: f.name,
                      lastModified: f.lastModified,
                      size: f.size,
                      type: f.type,
                      content: ev.target.result,
                    },
                  },
                };
                inputProps.onChange(event);
              };
              reader.readAsText(f);

              inputRef.current.value = f.name;
            }
          } catch (error: any) {
            console.log(error);
          }
        }}
      />
      <Input
        className={cn(
          "flex w-full p-0 px-2 py-[1.5px] text-sm border-none focus:outline-none focus:ring-0 shadow-none",
          error ? "border-destructive max-h-8 rounded-sm" : "max-h-8 rounded-am"
        )}
        // {...props}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        readOnly
        ref={inputRef}
      />
      <Label
        aria-label="Options"
        htmlFor={id}
        className="flex items-center justify-center p-0 w-11 dark:bg-input/30 border-input border-l h-9 min-w-0  bg-transparent focus:outline-none focus:ring-0"
      >
        <UploadIcon width={14} height={14} />
      </Label>
    </div>
  );
};
