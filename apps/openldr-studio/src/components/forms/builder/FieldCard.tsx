import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormField, FieldType } from "@/types/forms";
import { FIELD_TYPE_META } from "@/lib/constants";
import { IconButton, Badge, Toggle, Select } from "./ui";
import { Input } from "@/components/ui/input";
import { generateKey } from "@/lib/schema";
import { Plus, Trash2Icon } from "lucide-react";

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

const DATE_FORMAT_OPTIONS = [
  { value: "yyyy-MM-dd", label: "Date (yyyy-MM-dd)" },
  { value: "yyyy-MM-dd HH:mm:ss", label: "Date & Time (yyyy-MM-dd HH:mm:ss)" },
];

const STRING_FORMAT_OPTIONS = [
  { value: "", label: "None" },
  { value: "uuid", label: "UUID" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
];

const sectionLabel = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2";

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

  const handleTypeChange = (newType: FieldType) => {
    const patch: Partial<FormField> = {
      type: newType,
      // Clear all type-specific configs — the new type starts fresh
      _schemaProperty: undefined,
      dateConfig: undefined,
      optionsConfig: undefined,
      referenceConfig: undefined,
      fileConfig: undefined,
      stringConfig: undefined,
      numberConfig: undefined,
    };
    onUpdate(patch);
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="rounded-sm border transition-all duration-200 border-border bg-card">
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            {...attributes}
            {...listeners}
            className="flex flex-col gap-[3px] p-1 cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-70 transition-opacity touch-none"
          >
            {[0, 1, 2].map((r) => (
              <div key={r} className="flex gap-[3px]">
                <div className="w-[3px] h-[3px] rounded-full bg-[#607A94]" />
                <div className="w-[3px] h-[3px] rounded-full bg-[#607A94]" />
              </div>
            ))}
          </button>

          <Badge color={meta?.color ?? "#607A94"}>{meta?.icon ?? "?"}</Badge>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">
              {field.label || <span className="italic text-muted-foreground">Unnamed field</span>}
            </p>
            <p className="text-[10px] leading-tight mt-0.5 text-muted-foreground">
              {meta?.label ?? field.type}
              {field.key && <span className="ml-1 opacity-60">· {field.key}</span>}
              {field.required && (
                <span style={{ color: meta?.color }} className="ml-1">· required</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <IconButton variant="accent" onClick={onToggleExpand} title="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {field.expanded ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
              </svg>
            </IconButton>
            <IconButton variant="danger" onClick={onRemove} title="Remove">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
        </div>

        {/* ── Expanded Properties ── */}
        {field.expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-border flex flex-col gap-3">
            {/* Label + Key */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={field.label}
                placeholder="Field label"
                onChange={(e) => handleLabelChange(e.target.value)}
              />
              <Input
                value={field.key}
                placeholder="field_key"
                onChange={(e) => onUpdate({ key: e.target.value })}
                className="text-xs"
              />
            </div>

            {/* Type */}
            <Select
              value={field.type}
              options={FIELD_TYPE_OPTIONS}
              onChange={(e) => handleTypeChange(e.target.value as FieldType)}
            />

            {/* Placeholder (string/number) */}
            {(field.type === "string" || field.type === "number") && (
              <Input
                value={field.placeholder ?? ""}
                placeholder="Hint text shown in input..."
                onChange={(e) => onUpdate({ placeholder: e.target.value })}
              />
            )}

            {/* Description */}
            <Input
              value={field.description ?? ""}
              placeholder="Shown below the field..."
              onChange={(e) => onUpdate({ description: e.target.value })}
            />

            {/* ── Type-specific config ── */}

            {/* STRING: format + validation */}
            {field.type === "string" && (
              <>
                <div>
                  <p className={sectionLabel}>Format</p>
                  <Select
                    value={field.stringConfig?.format ?? ""}
                    options={STRING_FORMAT_OPTIONS}
                    onChange={(e) =>
                      onUpdate({
                        stringConfig: {
                          ...field.stringConfig,
                          format: e.target.value as any,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <p className={sectionLabel}>Validation</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={field.validation?.minLength ?? ""}
                      placeholder="Min length"
                      onChange={(e) =>
                        onUpdate({
                          validation: { ...field.validation, minLength: e.target.value ? +e.target.value : undefined },
                        })
                      }
                    />
                    <Input
                      type="number"
                      value={field.validation?.maxLength ?? ""}
                      placeholder="Max length"
                      onChange={(e) =>
                        onUpdate({
                          validation: { ...field.validation, maxLength: e.target.value ? +e.target.value : undefined },
                        })
                      }
                    />
                  </div>
                  <Input
                    value={field.validation?.pattern ?? ""}
                    placeholder="Regex pattern"
                    className="mt-2"
                    onChange={(e) =>
                      onUpdate({
                        validation: { ...field.validation, pattern: e.target.value || undefined },
                      })
                    }
                  />
                </div>
              </>
            )}

            {/* NUMBER: min/max + exclusive + multipleOf */}
            {field.type === "number" && (
              <div>
                <p className={sectionLabel}>Validation</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    value={field.validation?.min ?? ""}
                    placeholder="Min"
                    onChange={(e) =>
                      onUpdate({
                        validation: { ...field.validation, min: e.target.value ? +e.target.value : undefined },
                      })
                    }
                  />
                  <Input
                    type="number"
                    value={field.validation?.max ?? ""}
                    placeholder="Max"
                    onChange={(e) =>
                      onUpdate({
                        validation: { ...field.validation, max: e.target.value ? +e.target.value : undefined },
                      })
                    }
                  />
                </div>
                <Input
                  type="number"
                  value={field.numberConfig?.multipleOf ?? ""}
                  placeholder="Multiple of"
                  className="mt-2"
                  onChange={(e) =>
                    onUpdate({
                      numberConfig: {
                        ...field.numberConfig,
                        multipleOf: e.target.value ? +e.target.value : undefined,
                      },
                    })
                  }
                />
              </div>
            )}

            {/* DATE: format */}
            {field.type === "date" && (
              <div>
                <p className={sectionLabel}>Date Format</p>
                <Select
                  value={field.dateConfig?.format ?? "yyyy-MM-dd"}
                  options={DATE_FORMAT_OPTIONS}
                  onChange={(e) =>
                    onUpdate({ dateConfig: { format: e.target.value } })
                  }
                />
              </div>
            )}

            {/* SELECT: comma-separated options */}
            {field.type === "select" && (
              <Input
                value={field.options ?? ""}
                placeholder="Option A, Option B, Option C"
                onChange={(e) => onUpdate({ options: e.target.value })}
              />
            )}

            {/* OPTIONS: key-value pairs */}
            {field.type === "options" && (
              <div>
                <p className={sectionLabel}>Options (key / label)</p>
                <div className="flex flex-col gap-1.5">
                  {(field.optionsConfig?.entries ?? []).map(([val, label], idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_28px] gap-1.5">
                      <Input
                        value={val}
                        placeholder="Value"
                        onChange={(e) => {
                          const entries = [...(field.optionsConfig?.entries ?? [])];
                          entries[idx] = [e.target.value, entries[idx][1]];
                          onUpdate({ optionsConfig: { entries } });
                        }}
                      />
                      <Input
                        value={label}
                        placeholder="Label"
                        onChange={(e) => {
                          const entries = [...(field.optionsConfig?.entries ?? [])];
                          entries[idx] = [entries[idx][0], e.target.value];
                          onUpdate({ optionsConfig: { entries } });
                        }}
                      />
                      <IconButton
                        variant="danger"
                        onClick={() => {
                          const entries = (field.optionsConfig?.entries ?? []).filter((_, i) => i !== idx);
                          onUpdate({ optionsConfig: { entries } });
                        }}
                      >
                        <Trash2Icon width={12} height={12} />
                      </IconButton>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                    onClick={() => {
                      const entries: [string, string][] = [
                        ...(field.optionsConfig?.entries ?? []),
                        ["", ""],
                      ];
                      onUpdate({ optionsConfig: { entries } });
                    }}
                  >
                    <Plus width={12} height={12} /> Add option
                  </button>
                </div>
              </div>
            )}

            {/* REFERENCE: table, key, attributes */}
            {field.type === "reference" && (
              <div>
                <p className={sectionLabel}>Reference</p>
                <div className="flex flex-col gap-2">
                  <Input
                    value={field.referenceConfig?.table ?? ""}
                    placeholder="Table name"
                    onChange={(e) =>
                      onUpdate({
                        referenceConfig: {
                          table: e.target.value,
                          key: field.referenceConfig?.key ?? "",
                          attributes: field.referenceConfig?.attributes ?? [],
                        },
                      })
                    }
                  />
                  <Input
                    value={field.referenceConfig?.key ?? ""}
                    placeholder="Key column"
                    onChange={(e) =>
                      onUpdate({
                        referenceConfig: {
                          table: field.referenceConfig?.table ?? "",
                          key: e.target.value,
                          attributes: field.referenceConfig?.attributes ?? [],
                        },
                      })
                    }
                  />
                  <Input
                    value={field.referenceConfig?.attributes?.join(", ") ?? ""}
                    placeholder="Display attributes (comma-separated)"
                    onChange={(e) =>
                      onUpdate({
                        referenceConfig: {
                          table: field.referenceConfig?.table ?? "",
                          key: field.referenceConfig?.key ?? "",
                          attributes: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}

            {/* FILE: mime types */}
            {field.type === "file" && (
              <div>
                <p className={sectionLabel}>Allowed MIME types</p>
                <Input
                  value={field.fileConfig?.mimes?.join(", ") ?? ""}
                  placeholder="image/png, application/pdf"
                  onChange={(e) =>
                    onUpdate({
                      fileConfig: {
                        mimes: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                />
              </div>
            )}

            {/* Default value */}
            <Input
              value={field.defaultValue ?? ""}
              placeholder="Default value (leave blank for none)"
              onChange={(e) => onUpdate({ defaultValue: e.target.value })}
            />

            {/* Required */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className={sectionLabel + " mb-0"}>Required</span>
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
