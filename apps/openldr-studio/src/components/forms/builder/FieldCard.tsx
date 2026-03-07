import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormField, FieldType } from "@/types/forms";
import { FIELD_TYPE_META } from "@/lib/constants";
import { IconButton, Badge } from "./ui";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
// import {IconButton} from "@/components/ui/icon-button";
// import { Badge } from "@/components/ui/badge";
import { generateKey } from "@/lib/schema";

interface FieldCardProps {
  field: FormField;
  onUpdate: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onToggleExpand: () => void;
}

const FIELD_TYPE_OPTIONS = FIELD_TYPE_META.map((m) => ({
  value: m.type,
  label: m.label,
}));

export const FieldCard: React.FC<FieldCardProps> = ({
  field,
  onUpdate,
  onRemove,
  onToggleExpand,
}) => {
  const meta = FIELD_TYPE_META.find((m) => m.type === field.type)!;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleLabelChange = (label: string) => {
    const patch: Partial<FormField> = { label };
    if (!field.key) patch.key = generateKey(label);
    onUpdate(patch);
  };

  const hasOptions = field.type === "select" || field.type === "multiselect";
  const hasValidation = ["string", "textarea", "number", "email"].includes(
    field.type,
  );

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div
        className="rounded-sm border transition-all duration-200 border border-border bg-card"
        // style={{
        //   borderColor: field.expanded ? meta.color + "44" : "#1E2E42",
        // }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="flex flex-col gap-[3px] p-1 cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-70 transition-opacity touch-none"
          >
            <div className="flex gap-[3px]">
              <div className="w-[3px] h-[3px] rounded-full bg-[#607A94]" />
              <div className="w-[3px] h-[3px] rounded-full bg-[#607A94]" />
            </div>
            <div className="flex gap-[3px]">
              <div className="w-[3px] h-[3px] rounded-full bg-[#607A94]" />
              <div className="w-[3px] h-[3px] rounded-full bg-[#607A94]" />
            </div>
            <div className="flex gap-[3px]">
              <div className="w-[3px] h-[3px] rounded-full bg-[#607A94]" />
              <div className="w-[3px] h-[3px] rounded-full bg-[#607A94]" />
            </div>
          </button>

          {/* Type badge */}
          <Badge color={meta.color}>{meta.icon}</Badge>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">
              {field.label || <span className="italic">Unnamed field</span>}
            </p>
            <p className="text-[10px] leading-tight mt-0.5">
              {meta.label}
              {field.key && (
                <span className="ml-1 font-mono opacity-60">· {field.key}</span>
              )}
              {field.required && (
                <span style={{ color: meta.color }} className="ml-1">
                  · required
                </span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <IconButton variant="accent" onClick={onToggleExpand} title="Edit">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                {field.expanded ? (
                  <path d="M18 15l-6-6-6 6" />
                ) : (
                  <path d="M6 9l6 6 6-6" />
                )}
              </svg>
            </IconButton>
            <IconButton variant="danger" onClick={onRemove} title="Remove">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
        </div>

        {/* ── Expanded Properties ── */}
        {field.expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-[#1E2E42] flex flex-col gap-3">
            {/* Label + Key */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Label"
                value={field.label}
                placeholder="Field label"
                onChange={(e) => handleLabelChange(e.target.value)}
              />
              <Input
                label="Key (auto)"
                value={field.key}
                placeholder="field_key"
                onChange={(e) => onUpdate({ key: e.target.value })}
                className="font-mono text-xs"
              />
            </div>

            {/* Type */}
            <Select
              label="Type"
              value={field.type}
              options={FIELD_TYPE_OPTIONS}
              onChange={(e) => onUpdate({ type: e.target.value as FieldType })}
            />

            {/* Placeholder / Description */}
            {(field.type === "string" ||
              field.type === "textarea" ||
              field.type === "email" ||
              field.type === "number") && (
              <Input
                label="Placeholder"
                value={field.placeholder ?? ""}
                placeholder="Hint text shown in input..."
                onChange={(e) => onUpdate({ placeholder: e.target.value })}
              />
            )}

            <Input
              label="Description / Help text"
              value={field.description ?? ""}
              placeholder="Shown below the field..."
              onChange={(e) => onUpdate({ description: e.target.value })}
            />

            {/* Options */}
            {hasOptions && (
              <Input
                label="Options (comma-separated)"
                value={field.options ?? ""}
                placeholder="Option A, Option B, Option C"
                onChange={(e) => onUpdate({ options: e.target.value })}
              />
            )}

            {/* Default value */}
            <Input
              label="Default value"
              value={field.defaultValue ?? ""}
              placeholder="Leave blank for none"
              onChange={(e) => onUpdate({ defaultValue: e.target.value })}
            />

            {/* Validation */}
            {hasValidation && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#607A94] mb-2">
                  Validation
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {field.type === "number" ? (
                    <>
                      <Input
                        label="Min"
                        type="number"
                        value={field.validation?.min ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          onUpdate({
                            validation: {
                              ...field.validation,
                              min: +e.target.value,
                            },
                          })
                        }
                      />
                      <Input
                        label="Max"
                        type="number"
                        value={field.validation?.max ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          onUpdate({
                            validation: {
                              ...field.validation,
                              max: +e.target.value,
                            },
                          })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Input
                        label="Min length"
                        type="number"
                        value={field.validation?.minLength ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          onUpdate({
                            validation: {
                              ...field.validation,
                              minLength: +e.target.value,
                            },
                          })
                        }
                      />
                      <Input
                        label="Max length"
                        type="number"
                        value={field.validation?.maxLength ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          onUpdate({
                            validation: {
                              ...field.validation,
                              maxLength: +e.target.value,
                            },
                          })
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Required */}
            <div className="flex items-center justify-between pt-1 border-t border-[#1E2E42]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#607A94]">
                Required
              </span>
              <Toggle
                checked={field.required}
                onChange={(v) => onUpdate({ required: v })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
