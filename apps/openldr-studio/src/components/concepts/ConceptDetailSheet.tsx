import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil, Save, X, Underline } from "lucide-react";
import type {
  Concept,
  ConceptMapping,
} from "@/lib/restClients/conceptRestClient";

import CodeMirror from "@uiw/react-codemirror";
import { EditorState } from "@codemirror/state";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { getCurrentTheme } from "@/lib/theme";

interface ConceptDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concept: Concept | undefined;
  mappings: { from: ConceptMapping[]; to: ConceptMapping[] } | undefined;
  conceptClasses: string[];
  isNew?: boolean;
  systemId: string;
  onSave: (data: Partial<Concept>) => void;
  onDelete: () => void;
  onAddMapping: () => void;
  onEditMapping: (mapping: ConceptMapping) => void;
  onDeleteMapping: (id: string) => void;
  isSaving?: boolean;
}

export function ConceptDetailSheet({
  open,
  onOpenChange,
  concept,
  mappings,
  conceptClasses,
  isNew,
  systemId,
  onSave,
  onDelete,
  onAddMapping,
  onEditMapping,
  onDeleteMapping,
  isSaving,
}: ConceptDetailSheetProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [form, setForm] = useState<Partial<Concept>>(concept ? concept : {});

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

  const resetForm = (c: Concept | undefined) => {
    if (c) {
      setForm({
        concept_code: c.concept_code,
        display_name: c.display_name,
        concept_class: c.concept_class,
        datatype: c.datatype,
        is_active: c.is_active,
        properties: c.properties,
        names: c.names,
      });
    } else {
      setForm({
        concept_code: "",
        display_name: "",
        concept_class: null,
        datatype: null,
        is_active: true,
        properties: null,
        names: null,
      });
    }
  };

  // Reset form when concept changes or sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      resetForm(concept);
      setActiveTab("details");
    }
    onOpenChange(isOpen);
  };

  // Reset form when concept prop changes or sheet opens
  useEffect(() => {
    if (open) {
      resetForm(concept);
      setActiveTab("details");
    }
  }, [open, concept]);

  const handleSave = () => {
    onSave({
      ...form,
      system_id: systemId,
    });
  };

  const allMappings = [
    ...(mappings?.from ?? []).map((m) => ({
      ...m,
      direction: "from" as const,
    })),
    ...(mappings?.to ?? []).map((m) => ({ ...m, direction: "to" as const })),
  ];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-lg w-full p-0 m-0 gap-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-4 m-0 pb-2 border-b">
          <SheetTitle>{isNew ? "New Concept" : "Edit Concept"}</SheetTitle>
          <SheetDescription>
            {isNew
              ? "Create a new concept in this coding system"
              : `${concept?.concept_code ?? ""} - ${
                  concept?.display_name ?? ""
                }`}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="w-full border-b border-border" variant="line">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="mappings" disabled={isNew}>
              Mappings
              {allMappings.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-xs px-1.5 py-0 h-4"
                >
                  {allMappings.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-auto mt-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="concept_code" className="min-w-30">
                    Concept Code *
                  </Label>
                  <Input
                    id="concept_code"
                    value={form.concept_code ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, concept_code: e.target.value })
                    }
                    placeholder="e.g., 12345-6"
                    disabled={!isNew}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Label htmlFor="display_name" className="min-w-30">
                    Display Name *
                  </Label>
                  <Input
                    id="display_name"
                    value={form.display_name ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, display_name: e.target.value })
                    }
                    placeholder="e.g., Glucose [Mass/volume] in Blood"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Label htmlFor="concept_class" className="min-w-30">
                    Class
                  </Label>
                  <Input
                    className="w-full"
                    id="concept_class"
                    value={form.concept_class ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        concept_class: e.target.value || null,
                      })
                    }
                    placeholder="e.g., test, organism"
                    list="concept-classes"
                  />
                  <datalist id="concept-classes">
                    {conceptClasses.map((cls) => (
                      <option key={cls} value={cls} />
                    ))}
                  </datalist>
                </div>

                <div className="flex items-center space-x-2">
                  <Label htmlFor="datatype" className="min-w-30">
                    Datatype
                  </Label>
                  <Select
                    value={form.datatype ?? ""}
                    onValueChange={(val) =>
                      setForm({ ...form, datatype: val || null })
                    }
                  >
                    <SelectTrigger id="datatype" className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <SelectItem value="numeric">numeric</SelectItem>
                      <SelectItem value="coded">coded</SelectItem>
                      <SelectItem value="text">text</SelectItem>
                      <SelectItem value="datetime">datetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Label htmlFor="is_active" className="min-w-30">
                    Active
                  </Label>
                  <Select
                    value={form.is_active ? "true" : "false"}
                    onValueChange={(val) =>
                      setForm({ ...form, is_active: val === "true" })
                    }
                  >
                    <SelectTrigger id="is_active" className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-1 items-start space-x-2">
                  <Label htmlFor="properties" className="min-w-30 pt-2">
                    Properties
                  </Label>
                  <CodeMirror
                    id="properties"
                    value={
                      form.properties
                        ? JSON.stringify(form.properties, null, 2)
                        : ""
                    }
                    className="flex w-full h-full rounded-md border border-border bg-background px-3 py-2 text-sm "
                    onChange={(value) => {
                      try {
                        const parsed = value ? JSON.parse(value) : null;
                        setForm({ ...form, properties: parsed });
                      } catch {
                        // Allow invalid JSON while typing
                      }
                    }}
                    theme={theme === "dark" ? vscodeDark : vscodeLight}
                    extensions={[json(), EditorView.lineWrapping]}
                    placeholder='{"key": "value"}'
                  />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="mappings" className="flex-1 overflow-auto mt-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <span className="text-sm text-muted-foreground">
                  {allMappings.length} mapping
                  {allMappings.length !== 1 ? "s" : ""}
                </span>
                <Button size="sm" variant="outline" onClick={onAddMapping}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Mapping
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {allMappings.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No mappings found for this concept
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>System</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allMappings.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {m.map_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {m.direction === "from"
                              ? m.to_system_code_resolved ||
                                m.to_system_code ||
                                "-"
                              : m.from_system_code || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {m.direction === "from"
                              ? m.to_concept_code_resolved ||
                                m.to_concept_code ||
                                "-"
                              : m.from_concept_code || "-"}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[120px]">
                            {m.direction === "from"
                              ? m.to_concept_display_name ||
                                m.to_concept_name ||
                                "-"
                              : m.from_concept_display_name || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {m.direction === "from" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onEditMapping(m)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => onDeleteMapping(m.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between p-4 border-t">
          <div>
            {/* {!isNew && (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Deactivate
              </Button>
            )} */}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!form.concept_code || !form.display_name || isSaving}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
