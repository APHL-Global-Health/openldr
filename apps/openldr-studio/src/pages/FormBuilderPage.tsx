import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Separator } from "@/components/ui/separator";
import { useAppTranslation } from "@/i18n/hooks";
import { cn } from "@/lib/utils";
import type {
  TabId,
  FormField,
  FieldType,
  DateConfig,
  OptionsConfig,
  ReferenceConfig,
  FileConfig,
  StringConfig,
  NumberConfig,
  LabelConfig,
  VisibilityRule,
} from "@/types/forms";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";

import { ButtonGroup } from "@/components/ui/button-group";
import {
  Braces,
  CheckIcon,
  CopyIcon,
  Eye,
  Form,
  List,
  MoreHorizontalIcon,
  Pencil,
  Plus,
  Save,
  Trash2Icon,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { useQuery } from "@tanstack/react-query";
import type { TableData } from "@/pages/ArchivePage";

import * as SchemaRestClient from "@/lib/restClients/schemaRestClient";
import { manipulateData } from "@/lib/restClients/schemaRestClient";
import SchemaRecordSheet from "@/components/forms/schema-record-sheet";
import { AddFieldPanel } from "@/components/forms/builder/AddFieldPanel";
import { AutoForm } from "@/components/autoform";
import type { UseFormReturn } from "react-hook-form";
import { toZodSchema } from "@/lib/schemaUtils";
import { ZodProvider } from "@/lib/autoform/zod";
import { AutoFormProvider } from "@/components/autoform-provider";
import { FieldCard } from "@/components/forms/builder/FieldCard";
import { JsonTree } from "@/components/projects/JsonTree";
import { generateKey, fieldToSchemaProperty } from "@/lib/schema";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
} from "@/components/ui/input-group";

import CodeMirror from "@uiw/react-codemirror";
import { EditorState } from "@codemirror/state";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { getCurrentTheme } from "@/lib/theme";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Convert a JSON Schema `properties` object + `required` array into FormField[] */
function jsonSchemaToFields(schema: any): FormField[] {
  if (!schema?.properties) return [];
  const required: string[] = schema.required ?? [];

  // Collect conditionally-required keys from allOf if/then blocks
  const conditionallyRequired = new Set<string>();
  if (Array.isArray(schema.allOf)) {
    for (const rule of schema.allOf) {
      if (rule.if && rule.then?.required) {
        for (const key of rule.then.required) {
          conditionallyRequired.add(key);
        }
      }
    }
  }

  return Object.entries(schema.properties).map(
    ([key, val]: [string, any], i) => {
      // Detect type via x-zodType first, then fall back to format/type
      let fieldType: FieldType = "string";
      let dateConfig: DateConfig | undefined;
      let optionsConfig: OptionsConfig | undefined;
      let referenceConfig: ReferenceConfig | undefined;
      let fileConfig: FileConfig | undefined;
      let stringConfig: StringConfig | undefined;
      let numberConfig: NumberConfig | undefined;

      const xType = val["x-zodType"];
      let labelConfig: LabelConfig | undefined;
      let visibility: VisibilityRule | undefined;

      if (xType === "label") {
        fieldType = "label";
        const lbl = val["x-zodLabel"];
        labelConfig = {
          text: lbl?.text ?? "",
          variant: lbl?.variant ?? "h3",
        };
      } else if (xType === "separator") {
        fieldType = "separator";
      } else if (xType === "textarea") {
        fieldType = "textarea";
      } else if (xType === "date") {
        fieldType = "date";
        const opts: [string, string][] = val["x-zodOptions"] ?? [];
        const fmt = opts.find(([k]) => k === "format")?.[1];
        dateConfig = { format: fmt ?? "yyyy-MM-dd" };
      } else if (xType === "options") {
        fieldType = "options";
        const entries: [string, string][] = val["x-zodOptions"] ?? [];
        optionsConfig = { entries };
      } else if (xType === "reference") {
        fieldType = "reference";
        const ref = val["x-zodReference"];
        if (ref) {
          referenceConfig = {
            table: ref.table ?? "",
            key: ref.key ?? "",
            attributes: ref.attributes ?? [],
          };
        }
      } else if (xType === "file") {
        fieldType = "file";
        const file = val["x-zodFile"];
        if (file) {
          fileConfig = { mimes: file.mimes ?? [] };
        }
      } else if (val.enum) {
        fieldType = "select";
      } else if (val.format === "date" || val.format === "datetime") {
        fieldType = "date";
        dateConfig = {
          format:
            val.format === "datetime" ? "yyyy-MM-dd HH:mm:ss" : "yyyy-MM-dd",
        };
      } else if (val.type === "boolean") {
        fieldType = "boolean";
      } else if (val.type === "number" || val.type === "integer") {
        fieldType = "number";
        numberConfig = {
          exclusiveMin: val.exclusiveMinimum,
          exclusiveMax: val.exclusiveMaximum,
          multipleOf: val.multipleOf,
        };
      } else {
        // Plain string — check for format
        const fmt = val.format;
        if (fmt === "email" || fmt === "uuid" || fmt === "url") {
          stringConfig = { format: fmt };
        }
      }

      // Read visibility conditions
      if (val["x-zodVisibility"]) {
        visibility = val["x-zodVisibility"] as VisibilityRule;
      }

      return {
        id: `field-${key}-${i}`,
        type: fieldType,
        label: val.title || key,
        key,
        required: required.includes(key) || conditionallyRequired.has(key),
        placeholder: val.description ?? "",
        description: val.description ?? "",
        options: val.enum ? val.enum.join(", ") : undefined,
        defaultValue: val.default != null ? String(val.default) : undefined,
        validation: {
          min: val.minimum,
          max: val.maximum,
          minLength: val.minLength,
          maxLength: val.maxLength,
          pattern: val.pattern,
        },
        expanded: false,
        dateConfig,
        optionsConfig,
        referenceConfig,
        fileConfig,
        stringConfig,
        numberConfig,
        labelConfig,
        visibility,
        _schemaProperty: structuredClone(val),
      };
    },
  );
}

/** Rebuild a JSON Schema from FormField[]. Always regenerates via fieldToSchemaProperty()
 *  which uses _schemaProperty internally to preserve unknown extensions while applying edits. */
function fieldsToJsonSchema(fields: FormField[], baseSchema: any): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  const conditionalRules: any[] = [];

  for (const field of fields) {
    const key = field.key || generateKey(field.label) || `field_${field.id}`;
    properties[key] = fieldToSchemaProperty(field);

    if (field.required && field.visibility?.conditions?.length) {
      // Build a JSON Schema if/then block so the backend jsonschema
      // validator can enforce "required" only when conditions are met.
      const ifClause = buildIfClause(field.visibility);
      if (ifClause) {
        conditionalRules.push({
          if: ifClause,
          then: { required: [key] },
        });
      }
    } else if (field.required) {
      required.push(key);
    }
  }

  return {
    ...baseSchema,
    properties,
    ...(required.length ? { required } : { required: undefined }),
    ...(conditionalRules.length
      ? { allOf: conditionalRules }
      : { allOf: undefined }),
  };
}

/** Convert a VisibilityRule into a JSON Schema `if` clause. */
function buildIfClause(
  visibility: import("@/types/forms").VisibilityRule,
): any | null {
  const conditionSchemas = visibility.conditions
    .map((cond) => {
      switch (cond.operator) {
        case "equals":
          return { properties: { [cond.field]: { const: cond.value } } };
        case "notEquals":
          return {
            properties: { [cond.field]: { not: { const: cond.value } } },
          };
        default:
          // Operators like contains, gt, lt, isEmpty etc. are hard to
          // express in JSON Schema — skip them (frontend still enforces).
          return null;
      }
    })
    .filter(Boolean);

  if (conditionSchemas.length === 0) return null;

  if (conditionSchemas.length === 1) return conditionSchemas[0];

  // Multiple conditions
  return visibility.logic === "and"
    ? { allOf: conditionSchemas }
    : { anyOf: conditionSchemas };
}

function FormBuilderPage() {
  const { t } = useAppTranslation();

  const [theme, setTheme] = useState(getCurrentTheme);

  useEffect(() => {
    const onThemeChange = () => {
      setTheme(getCurrentTheme());
    };
    window.addEventListener("themechange", onThemeChange);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onThemeChange);

    return () => {
      window.removeEventListener("themechange", onThemeChange);
      mq.removeEventListener("change", onThemeChange);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [mobileTab, setMobileTab] = useState<"builder" | "right">("builder");

  const client = useKeycloakClient();

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [isEditMode, setEditMode] = useState(false);

  const [schema, setSchema] = useState<string | undefined>("Internal");
  const [table, setTable] = useState<string | undefined>("formSchemas");
  const [formSchemaId, setFormSchemaId] = useState<string | undefined>(
    undefined,
  );

  const [rawJsonSchema, setRawJsonSchema] = useState<any | undefined>(
    undefined,
  );
  const [jsonSchema, setJsonSchema] = useState<ZodProvider<any> | undefined>(
    undefined,
  );
  const [fields, setFields] = useState<FormField[]>([]);

  const [selectedRecordItem, setSelectedRecordItem] = useState<any | undefined>(
    undefined,
  );

  const [form, setForm] = useState<UseFormReturn<any, any, any> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [isRecordSheetOpen, setRecordSheetOpen] = useState(false);

  const { data, refetch } = useQuery<TableData>({
    queryKey: ["Data", "ProjectsPage", table, schema],
    queryFn: async () => {
      if (table && schema) {
        const filter: any = {};

        const cols = await SchemaRestClient.getTableColumns(
          table,
          client.kc.token,
        );

        const msg = await SchemaRestClient.getTableData(
          table,
          filter,
          client.kc.token,
        );

        const { rows } = msg.data;

        return {
          totalPages: 1,
          items: rows,
          columns: (cols?.data || []).map((row) => {
            return {
              id: row.Name,
              name: row.Name.replace(/([A-Z]+)/g, " $1")
                .replace(/([A-Z][a-z])/g, " $1")
                .trim()
                .replace(/^./, (str) => str.toUpperCase())
                .replace(/\s+/g, " "),
              type: row.Type,
              nullable: row.Nullable,
              primaryKey: row.PrimaryKey || false,
              constraint: row.Constraint,
            };
          }),
        };
      }
      return { items: [] };
    },
    refetchInterval: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  // ── Rebuild schemas from fields ──
  const rebuildSchemas = useCallback(
    (updatedFields: FormField[]) => {
      if (!rawJsonSchema) return;
      const newSchema = fieldsToJsonSchema(updatedFields, rawJsonSchema);
      setRawJsonSchema(newSchema);
      try {
        const zodSchema = toZodSchema(newSchema);
        setJsonSchema(new ZodProvider(zodSchema as any));
      } catch {
        // schema may be temporarily invalid while editing
      }
    },
    [rawJsonSchema],
  );

  // ── Field management ──
  const addField = useCallback(
    (type: FieldType) => {
      const newField: FormField = {
        id: `field-${Date.now()}`,
        type,
        label: "",
        key: "",
        required: false,
        expanded: true,
      };
      const next = [...fields, newField];
      setFields(next);
      rebuildSchemas(next);
    },
    [fields, rebuildSchemas],
  );

  const updateField = useCallback(
    (fieldId: string, patch: Partial<FormField>) => {
      const next = fields.map((f) => {
        if (f.id !== fieldId) return f;
        const updated = { ...f, ...patch };
        if (patch.label !== undefined && !f.key) {
          updated.key = generateKey(patch.label);
        }
        return updated;
      });
      setFields(next);
      rebuildSchemas(next);
    },
    [fields, rebuildSchemas],
  );

  const removeField = useCallback(
    (fieldId: string) => {
      const next = fields.filter((f) => f.id !== fieldId);
      setFields(next);
      rebuildSchemas(next);
    },
    [fields, rebuildSchemas],
  );

  const toggleFieldExpanded = useCallback((fieldId: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, expanded: !f.expanded } : f)),
    );
  }, []);

  // ── Drag & Drop ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(fields, oldIndex, newIndex);
      setFields(next);
      rebuildSchemas(next);
    },
    [fields, rebuildSchemas],
  );

  // ── Form selection ──
  const handleFormSelect = useCallback(
    (val: string) => {
      setFormSchemaId(val);
      const item = data?.items.find((f: any) => f.schemaId === val);
      if (item) {
        const schemaData = item.schema;
        setRawJsonSchema(schemaData);
        setFields(jsonSchemaToFields(schemaData));
        try {
          const zodSchema = toZodSchema(schemaData);
          setJsonSchema(new ZodProvider(zodSchema as any));
        } catch {
          setJsonSchema(undefined);
        }
      } else {
        setRawJsonSchema(undefined);
        setJsonSchema(undefined);
        setFields([]);
      }
    },
    [data],
  );

  // ── CRUD helpers ──
  const onSubmit = async (submitData: any, _isEditMode?: boolean) => {
    let _data = submitData;
    if (selectedRecordItem) {
      _data = { ...selectedRecordItem, ...submitData };
    }

    const effectiveEditMode = _isEditMode ?? isEditMode;

    if (table && schema) {
      const results = await Promise.allSettled([
        manipulateData(
          table,
          schema,
          "archive",
          _data,
          client.kc.token,
          !effectiveEditMode ? "POST" : "PUT",
        ),
      ]);

      const successful = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");
      if (successful.length > 0) {
        toast.success(
          `(${successful.length}) ${
            !selectedRecordItem ? "created" : "updated"
          } successfully`,
          { className: "bg-card text-card-foreground border-border" },
        );
      }
      if (failed.length > 0) {
        toast.error(
          `Failed to ${
            !selectedRecordItem ? "create" : "update"
          }. Please try again.`,
          { className: "bg-card text-card-foreground border-border" },
        );
      }
      refetch();
      setSelectedRecordItem(undefined);
      setRecordSheetOpen(false);
    }
  };

  const onDelete = async (
    deleteData: any,
    _table?: string,
    _schema?: string,
  ) => {
    const effectiveTable = _table ?? table;
    const effectiveSchema = _schema ?? schema;
    if (effectiveTable && effectiveSchema) {
      const results = await Promise.allSettled([
        manipulateData(
          effectiveTable,
          effectiveSchema,
          "archive",
          deleteData,
          client.kc.token,
          "DELETE",
        ),
      ]);

      const successful = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");
      if (successful.length > 0) {
        toast.success(`(${successful.length}) deleted successfully`, {
          className: "bg-card text-card-foreground border-border",
        });
      }
      if (failed.length > 0) {
        toast.error("Failed to delete. Please try again.", {
          className: "bg-card text-card-foreground border-border",
        });
      }
      refetch();
      setFormSchemaId(undefined);
      setRawJsonSchema(undefined);
      setJsonSchema(undefined);
      setFields([]);
      setSelectedRecordItem(undefined);
      setRecordSheetOpen(false);
    }
  };

  const EditData = (
    schemaName: string,
    tableName: string,
    item: any = undefined,
    editMode: boolean = false,
  ) => {
    setEditMode(editMode);
    setSchema(schemaName);
    setTable(tableName);
    setSelectedRecordItem(item);
    setRecordSheetOpen(true);
  };

  // ── Nav tabs ──
  const navComponents = () => (
    <div className="flex min-h-13 max-h-13 w-full items-center pr-2 py-2">
      <h1 className="font-bold">{t("forms.title")}</h1>
      {/* <Separator orientation="vertical" className="mx-2 min-h-6" /> */}
      <div className="flex flex-1" />

      <div className="flex flex-row items-center px-2">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as TabId);
          }}
        >
          <ToggleGroupItem
            value="preview"
            className="text-sm items-center px-4 rounded-none"
          >
            <Eye width={16} height={16} />
          </ToggleGroupItem>
          <ToggleGroupItem value="schema" className="text-sm items-center px-4">
            <Braces width={16} height={16} />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex md:hidden items-center gap-1 bg-[#111E30] rounded-lg p-1 border border-border">
        {(["builder", "right"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              mobileTab === t
                ? "bg-[#1A2C40] text-[#6EE7B7]"
                : "text-[#607A94]",
            )}
          >
            {t === "builder" ? "Builder" : "Preview"}
          </button>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-2 min-h-6" />
    </div>
  );

  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-row min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        {/* ── Sidebar ── */}
        <aside
          className={cn(
            "shrink-0 w-full md:w-[320px] lg:w-90 border-r border-border overflow-hidden flex-col",
            mobileTab === "builder" ? "flex" : "hidden",
            "md:flex",
          )}
        >
          <div className="flex flex-col h-full overflow-hidden">
            {/* ── Form selector ── */}
            <div className="shrink-0 border-b border-border p-3 ">
              <ButtonGroup className="w-full focus-visible:outline-none">
                <Select
                  key={formSchemaId ?? "__empty__"}
                  disabled={(data?.items || []).length === 0 ? true : false}
                  value={formSchemaId}
                  onValueChange={handleFormSelect}
                >
                  <SelectTrigger className="flex flex-1 rounded-sm text-sm focus-visible:outline-none">
                    <SelectValue placeholder="Form" />
                  </SelectTrigger>
                  <SelectContent
                    className="rounded-xs"
                    side="bottom"
                    avoidCollisions={false}
                    position="popper"
                  >
                    <SelectGroup>
                      {data?.items?.map((f: any) => (
                        <SelectItem key={f.schemaId} value={f.schemaId}>
                          {f.schemaName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <div className="flex justify-center items-center min-h-9 max-h-9 w-[0.5px]">
                  <div className="flex bg-border min-h-7 max-h-7 w-[0.5px]" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    className="disabled:cursor-not-allowed"
                  >
                    <Button
                      className="rounded-sm disabled:cursor-not-allowed"
                      variant="outline"
                      size="icon"
                      aria-label="More Options"
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() => EditData("Internal", "formSchemas")}
                      >
                        <Plus width={16} height={16} />
                        New
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!formSchemaId}
                        onClick={() => {
                          const item = data?.items.find(
                            (f: any) => f.schemaId === formSchemaId,
                          );
                          EditData("Internal", "formSchemas", item, true);
                        }}
                      >
                        <Pencil width={16} height={16} />
                        Edit
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        disabled={activeTab !== "preview" || !formSchemaId}
                        onClick={() => {
                          setShowAddPanel((v) => !v);
                        }}
                      >
                        <Form width={16} height={16} />
                        Fields
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={!formSchemaId}
                        onClick={() => {
                          if (formSchemaId)
                            onDelete([formSchemaId], "formSchemas", "Internal");
                        }}
                      >
                        <Trash2Icon />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ButtonGroup>
            </div>

            {/* ── Fields header ── */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border">
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Fields {fields.length > 0 ? `(${fields.length})` : ""}
              </span>
              {rawJsonSchema && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-border rounnded-sm"
                    onClick={() => {
                      const item = data?.items.find(
                        (f: any) => f.schemaId === formSchemaId,
                      );
                      if (item) {
                        item.schema = JSON.stringify(rawJsonSchema);
                        onSubmit(item, true);
                      }
                    }}
                  >
                    <Save width={16} height={16} />
                  </Button>
                </div>
              )}
            </div>

            {/* ── Field list (scrollable) ── */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {!rawJsonSchema && (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M9 12h6M12 9v6" />
                  </svg>
                  <p className="text-sm">Select or create a form above</p>
                </div>
              )}

              {rawJsonSchema && fields.length === 0 && !showAddPanel && (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  >
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M8 10h8M8 14h5" />
                  </svg>
                  <p className="text-sm font-medium">No fields yet</p>
                  <p className="text-xs">
                    Click "+ Add Field" to start building
                  </p>
                </div>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <FieldCard
                        key={field.id}
                        field={field}
                        allFields={fields}
                        onUpdate={(patch) => updateField(field.id, patch)}
                        onRemove={() => removeField(field.id)}
                        onToggleExpand={() => toggleFieldExpanded(field.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </aside>

        {/* ── Main panel ── */}
        <main
          className={cn(
            "flex-1 flex flex-col overflow-hidden",
            mobileTab === "right" ? "flex" : "hidden",
            "md:flex",
          )}
        >
          {activeTab === "preview" ? (
            jsonSchema ? (
              <div className="flex-1 overflow-y-auto py-3">
                <AutoForm
                  onFormInit={(initForm: any) => setForm(initForm)}
                  formProps={{
                    ref: formRef,
                    className:
                      "grid grid-cols-[24px_auto_1fr] h-fit gap-y-2 w-full px-2 py-3",
                  }}
                  uiComponents={{}}
                  schema={jsonSchema}
                  onSubmit={() => {}}
                  withSubmit={false}
                />
              </div>
            ) : (
              <div className="flex  items-center justify-center min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] relative">
                <div className="flex flex-1 h-full w-full relative">
                  <svg
                    className="absolute inset-0 size-full z-0 stroke-foreground/10 m-0 p-0"
                    fill="none"
                  >
                    <defs>
                      <pattern
                        id="pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e"
                        x="0"
                        y="0"
                        width="10"
                        height="10"
                        patternUnits="userSpaceOnUse"
                      >
                        <path d="M-3 13 15-5M-5 5l18-18M-1 21 17 3"></path>
                      </pattern>
                    </defs>
                    <rect
                      stroke="none"
                      fill="url(#pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e)"
                      width="100%"
                      height="100%"
                    ></rect>
                  </svg>
                </div>

                <Card className="w-75 cursor-default p-0 m-0 gap-0 rounded-sm bg-background absolute">
                  <CardHeader className="pb-0 py-2">
                    <CardTitle>{"Forms"}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm border py-4">
                    Select a form to preview
                  </CardContent>
                </Card>
              </div>
            )
          ) : jsonSchema ? (
            <div className="flex flex-col w-full h-full py-3">
              <div className="flex w-full justify-between px-3 border-b border-border min-h-9 max-h-9">
                <div>{/* Title */}</div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    if (rawJsonSchema) {
                      navigator.clipboard.writeText(
                        JSON.stringify(rawJsonSchema, null, 2),
                      );
                      setSchemaCopied(true);
                      setTimeout(() => setSchemaCopied(false), 2000);
                    }
                  }}
                >
                  {schemaCopied ? (
                    <CheckIcon className="text-green-500" />
                  ) : (
                    <CopyIcon />
                  )}
                </Button>
              </div>
              <div className="flex w-full flex-1 overflow-y-auto">
                <CodeMirror
                  value={JSON.stringify(rawJsonSchema, null, 2)}
                  className="w-full"
                  theme={theme === "dark" ? vscodeDark : vscodeLight}
                  extensions={[
                    EditorState.readOnly.of(true),
                    EditorView.editable.of(false),
                    json(),
                    EditorView.lineWrapping,
                  ]}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <p className="text-sm">Select a form to view schema</p>
            </div>
          )}
        </main>
      </div>

      {/* ── Record Sheet Modal ── */}
      <SchemaRecordSheet
        isOpen={isRecordSheetOpen}
        data={{
          columns: data ? data.columns : [],
          table: table || "",
          schema: schema || "",
        }}
        onSubmit={(data) => {
          onSubmit(data);
        }}
        onDelete={onDelete}
        onCleared={() => {}}
        value={selectedRecordItem}
        setOpen={setRecordSheetOpen}
        onOpenChange={(value: boolean) => {
          if (!value) setSelectedRecordItem(undefined);
          setRecordSheetOpen(value);
        }}
      />

      <Sheet open={showAddPanel} onOpenChange={setShowAddPanel}>
        <SheetContent showCloseButton={false}>
          <SheetHeader className="pb-0">
            <SheetTitle>Field Component</SheetTitle>
            <SheetDescription>Select one you want</SheetDescription>
          </SheetHeader>

          <AddFieldPanel
            inline
            onAdd={(type) => {
              addField(type);
              setShowAddPanel(false);
            }}
            onClose={() => setShowAddPanel(false)}
          />
        </SheetContent>
      </Sheet>
    </ContentLayout>
  );
}

function HelperPage() {
  return (
    <AutoFormProvider>
      <FormBuilderPage />
    </AutoFormProvider>
  );
}

export default HelperPage;
