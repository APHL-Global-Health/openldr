import React, { useState } from "react";
import type { FormDefinition, FormField } from "@/types/forms";
import { FIELD_TYPE_META } from "@/lib/constants";
import { Button } from "./ui";

interface FormPreviewProps {
  form: FormDefinition | null;
}

type FormValues = Record<string, string | boolean | string[]>;

function FieldPreview({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean | string[];
  onChange: (val: string | boolean | string[]) => void;
}) {
  const meta = FIELD_TYPE_META.find((m) => m.type === field.type)!;

  const baseInput =
    "w-full bg-[#0F1E2E] border border-[#2A3F57] text-[#E2EAF4] rounded-lg px-3 py-2 text-sm placeholder:text-[#3A5068] focus:border-[#6EE7B7] focus:ring-1 focus:ring-[#6EE7B7]/30 outline-none transition-colors";

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-[#A0B4C8]">
          {field.label}
        </span>
        {field.required && (
          <span className="text-[10px] font-bold" style={{ color: meta?.color }}>
            *
          </span>
        )}
      </label>

      {field.description && (
        <p className="text-[11px] text-[#4A6480] -mt-1">{field.description}</p>
      )}

      {field.type === "boolean" ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(!value)}
            className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
              value ? "bg-[#6EE7B7]" : "bg-[#2A3F57]"
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                value ? "left-5" : "left-1"
              }`}
            />
          </button>
          <span className="text-sm text-[#A0B4C8]">{value ? "Yes" : "No"}</span>
        </div>
      ) : field.type === "select" || field.type === "options" ? (
        <select
          className={baseInput}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {(field.options ?? "").split(",").map((o) => (
            <option key={o.trim()} value={o.trim()}>
              {o.trim()}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={
            field.type === "date"
              ? "date"
              : field.type === "number"
              ? "number"
              : "text"
          }
          className={baseInput}
          placeholder={field.placeholder}
          value={value as string}
          min={field.validation?.min}
          max={field.validation?.max}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export const FormPreview: React.FC<FormPreviewProps> = ({ form }) => {
  const [values, setValues] = useState<FormValues>({});
  const [submitted, setSubmitted] = useState(false);

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[#3A5068]">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M8 10h8M8 14h5" />
        </svg>
        <p className="text-sm">No form selected</p>
      </div>
    );
  }

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="max-w-lg mx-auto w-full py-6 px-4">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#E2EAF4] leading-tight">
          {form.name}
        </h2>
        {form.description && (
          <p className="mt-1.5 text-sm text-[#607A94]">{form.description}</p>
        )}
      </div>

      {submitted && (
        <div className="mb-6 rounded-xl border border-[#6EE7B7]/30 bg-[#6EE7B7]/10 px-4 py-3 flex items-center gap-3">
          <span className="text-[#6EE7B7] text-lg">✓</span>
          <div>
            <p className="text-sm font-semibold text-[#6EE7B7]">
              Form submitted
            </p>
            <p className="text-xs text-[#4A6480] mt-0.5">
              Values logged to console
            </p>
          </div>
        </div>
      )}

      {form.fields.length === 0 ? (
        <div className="text-center py-16 text-[#3A5068]">
          <p className="text-sm">
            Add fields in the Builder to see a preview here.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {form.fields.map((field) => (
            <div
              key={field.id}
              className="p-4 rounded-xl bg-[#111E30] border border-[#1E2E42]"
            >
              <FieldPreview
                field={field}
                value={
                  values[field.key] ??
                  (field.type === "boolean" ? false : "")
                }
                onChange={(val) =>
                  setValues((v) => ({ ...v, [field.key]: val }))
                }
              />
            </div>
          ))}

          <Button
            variant="primary"
            className="w-full justify-center py-3"
            onClick={handleSubmit}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
            Submit {form.name}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => {
              setValues({});
              setSubmitted(false);
            }}
          >
            Reset form
          </Button>
        </div>
      )}
    </div>
  );
};
