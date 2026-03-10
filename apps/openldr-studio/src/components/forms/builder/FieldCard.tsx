import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormField, FieldType } from "@/types/forms";
import { FIELD_TYPE_META } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { generateKey } from "@/lib/schema";
import { ChevronUp, ChevronDown, Plus, Trash2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  {
    value: "yyyy-MM-dd HH:mm:ss",
    label: "Date & Time (yyyy-MM-dd HH:mm:ss)",
  },
];

const STRING_FORMAT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "uuid", label: "UUID" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
];

const sectionLabel =
  "text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2";

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
                <div className="w-[3px] h-[3px] rounded-full bg-muted-foreground/50" />
                <div className="w-[3px] h-[3px] rounded-full bg-muted-foreground/50" />
              </div>
            ))}
          </button>

          <Badge
            variant="outline"
            className="size-6 rounded-md justify-center p-0 text-xs font-bold"
            style={{
              background: (meta?.color ?? "#607A94") + "22",
              color: meta?.color ?? "#607A94",
              borderColor: (meta?.color ?? "#607A94") + "44",
            }}
          >
            {meta?.icon ?? "?"}
          </Badge>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">
              {field.label || (
                <span className="italic text-muted-foreground">
                  Unnamed field
                </span>
              )}
            </p>
            <p className="text-[10px] leading-tight mt-0.5 text-muted-foreground">
              {meta?.label ?? field.type}
              {field.key && (
                <span className="ml-1 opacity-60">· {field.key}</span>
              )}
              {field.required && (
                <span style={{ color: meta?.color }} className="ml-1">
                  · required
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onToggleExpand}
              title="Edit"
            >
              {field.expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              title="Remove"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3.5" />
            </Button>
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
              onValueChange={(val) => handleTypeChange(val as FieldType)}
            >
              <SelectTrigger className="w-full flex flex-1 rounded-sm text-sm focus-visible:outline-none">
                <SelectValue placeholder="Form" />
              </SelectTrigger>
              <SelectContent
                className="rounded-xs"
                side="bottom"
                avoidCollisions={false}
                position="popper"
              >
                <SelectGroup>
                  {FIELD_TYPE_OPTIONS.map((o: any) => (
                    <SelectItem value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

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
                    value={field.stringConfig?.format || "none"}
                    onValueChange={(val) =>
                      onUpdate({
                        stringConfig: {
                          ...field.stringConfig,
                          format: (val === "none" ? "" : val) as any,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="w-full flex flex-1 rounded-sm text-sm focus-visible:outline-none">
                      <SelectValue placeholder="Form" />
                    </SelectTrigger>
                    <SelectContent
                      className="rounded-xs"
                      side="bottom"
                      avoidCollisions={false}
                      position="popper"
                    >
                      <SelectGroup>
                        {STRING_FORMAT_OPTIONS.map((o: any) => (
                          <SelectItem value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
                          validation: {
                            ...field.validation,
                            minLength: e.target.value
                              ? +e.target.value
                              : undefined,
                          },
                        })
                      }
                    />
                    <Input
                      type="number"
                      value={field.validation?.maxLength ?? ""}
                      placeholder="Max length"
                      onChange={(e) =>
                        onUpdate({
                          validation: {
                            ...field.validation,
                            maxLength: e.target.value
                              ? +e.target.value
                              : undefined,
                          },
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
                        validation: {
                          ...field.validation,
                          pattern: e.target.value || undefined,
                        },
                      })
                    }
                  />
                </div>
              </>
            )}

            {/* NUMBER: min/max + multipleOf */}
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
                        validation: {
                          ...field.validation,
                          min: e.target.value ? +e.target.value : undefined,
                        },
                      })
                    }
                  />
                  <Input
                    type="number"
                    value={field.validation?.max ?? ""}
                    placeholder="Max"
                    onChange={(e) =>
                      onUpdate({
                        validation: {
                          ...field.validation,
                          max: e.target.value ? +e.target.value : undefined,
                        },
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
                        multipleOf: e.target.value
                          ? +e.target.value
                          : undefined,
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
                  onValueChange={(val) =>
                    onUpdate({ dateConfig: { format: val } })
                  }
                >
                  <SelectTrigger className="w-full flex flex-1 rounded-sm text-sm focus-visible:outline-none">
                    <SelectValue placeholder="Form" />
                  </SelectTrigger>
                  <SelectContent
                    className="rounded-xs"
                    side="bottom"
                    avoidCollisions={false}
                    position="popper"
                  >
                    <SelectGroup>
                      {DATE_FORMAT_OPTIONS.map((o: any) => (
                        <SelectItem value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
                  {(field.optionsConfig?.entries ?? []).map(
                    ([val, label], idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[1fr_1fr_28px] gap-1.5"
                      >
                        <Input
                          value={val}
                          placeholder="Value"
                          onChange={(e) => {
                            const entries = [
                              ...(field.optionsConfig?.entries ?? []),
                            ];
                            entries[idx] = [e.target.value, entries[idx][1]];
                            onUpdate({ optionsConfig: { entries } });
                          }}
                        />
                        <Input
                          value={label}
                          placeholder="Label"
                          onChange={(e) => {
                            const entries = [
                              ...(field.optionsConfig?.entries ?? []),
                            ];
                            entries[idx] = [entries[idx][0], e.target.value];
                            onUpdate({ optionsConfig: { entries } });
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            const entries = (
                              field.optionsConfig?.entries ?? []
                            ).filter((_, i) => i !== idx);
                            onUpdate({ optionsConfig: { entries } });
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ),
                  )}
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
                    <Plus className="size-3" /> Add option
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
              <Switch
                checked={field.required}
                onCheckedChange={(v) => onUpdate({ required: v })}
                size="sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
