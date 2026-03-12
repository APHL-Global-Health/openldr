import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Search } from "lucide-react";
import type {
  ConceptMapping,
  Concept,
} from "@/lib/restClients/conceptRestClient";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "../ui/separator";

interface MappingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapping: ConceptMapping | undefined; // null = create mode
  fromConceptId: string;
  fromConceptCode: string;
  fromConceptName: string;
  onSave: (data: Partial<ConceptMapping>) => void;
  onSearch: (query: string) => Promise<Concept[]>;
  isSaving?: boolean;
}

const MAP_TYPES = ["SAME-AS", "NARROWER-THAN", "BROADER-THAN", "RELATED-TO"];

export function MappingFormDialog({
  open,
  onOpenChange,
  mapping,
  fromConceptId,
  fromConceptCode,
  fromConceptName,
  onSave,
  onSearch,
  isSaving,
}: MappingFormDialogProps) {
  const [form, setForm] = useState<Partial<ConceptMapping>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Concept[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [useManualEntry, setUseManualEntry] = useState(true);

  useEffect(() => {
    if (open) {
      if (mapping) {
        setForm({
          to_concept_id: mapping.to_concept_id,
          to_system_code: mapping.to_system_code,
          to_concept_code: mapping.to_concept_code,
          to_concept_name: mapping.to_concept_name,
          map_type: mapping.map_type,
          relationship: mapping.relationship,
          owner: mapping.owner,
        });
        setUseManualEntry(!mapping.to_concept_id);
      } else {
        setForm({
          from_concept_id: fromConceptId,
          map_type: "SAME-AS",
        });
        setUseManualEntry(false);
      }
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open, mapping, fromConceptId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await onSearch(searchQuery);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectConcept = (concept: Concept) => {
    setForm({
      ...form,
      to_concept_id: concept.id,
      to_system_code: concept.system_code ?? null,
      to_concept_code: concept.concept_code,
      to_concept_name: concept.display_name,
    });
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleSave = () => {
    onSave({
      ...form,
      from_concept_id: fromConceptId,
    });
  };

  const isEdit = mapping !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Mapping" : "New Mapping"}</SheetTitle>
          <SheetDescription>
            Map from: {fromConceptCode} - {fromConceptName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-2 px-2 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center space-x-2">
            <Label className="min-w-30">Map Type *</Label>
            <Select
              value={form.map_type ?? "SAME-AS"}
              onValueChange={(val) => setForm({ ...form, map_type: val })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAP_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="relationship" className="min-w-30">
              Relationship
            </Label>
            <Input
              id="relationship"
              value={form.relationship ?? ""}
              onChange={(e) =>
                setForm({ ...form, relationship: e.target.value || null })
              }
              placeholder="Optional finer-grained relationship label"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="mapping_owner" className="min-w-30">
              Owner
            </Label>
            <Input
              id="mapping_owner"
              value={form.owner ?? ""}
              onChange={(e) =>
                setForm({ ...form, owner: e.target.value || null })
              }
              placeholder="Who created this mapping"
            />
          </div>

          <Separator />

          <div className="flex flex-col space-x-2">
            <div className="flex pb-4 items-center justify-between">
              <Label>Target Concept</Label>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  setUseManualEntry(!useManualEntry);
                  if (!useManualEntry) {
                    setForm({ ...form, to_concept_id: undefined });
                  }
                }}
              >
                {useManualEntry ? "Search concepts" : "Enter manually"}
              </Button>
            </div>

            {useManualEntry ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Label className="text-xs min-w-30">System Code</Label>
                  <Input
                    value={form.to_system_code ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        to_system_code: e.target.value || null,
                      })
                    }
                    placeholder="e.g., LOINC"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Label className="text-xs min-w-30">Concept Code</Label>
                  <Input
                    value={form.to_concept_code ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        to_concept_code: e.target.value || null,
                      })
                    }
                    placeholder="e.g., 12345-6"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Label className="text-xs min-w-30">Concept Name</Label>
                  <Input
                    value={form.to_concept_name ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        to_concept_name: e.target.value || null,
                      })
                    }
                    placeholder="e.g., Glucose"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a concept..."
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSearch}
                    disabled={isSearching}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {form.to_concept_code && (
                  <div className="text-sm p-2 rounded border bg-muted/50">
                    <span className="font-mono">
                      {form.to_system_code}:{form.to_concept_code}
                    </span>
                    {" - "}
                    <span>{form.to_concept_name}</span>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="border rounded max-h-[200px] overflow-auto">
                    {searchResults.map((concept) => (
                      <div
                        key={concept.id}
                        className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer text-sm border-b last:border-b-0"
                        onClick={() => selectConcept(concept)}
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {concept.system_code}
                        </span>
                        <span className="font-mono text-xs">
                          {concept.concept_code}
                        </span>
                        <span className="truncate">{concept.display_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {isSearching && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    Searching...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full flex gap-2 p-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              !form.map_type ||
              (!form.to_concept_id && !form.to_concept_code) ||
              isSaving
            }
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
