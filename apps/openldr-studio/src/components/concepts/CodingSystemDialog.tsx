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
import { Save } from "lucide-react";
import type { CodingSystem } from "@/lib/restClients/conceptRestClient";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface CodingSystemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  system: CodingSystem | undefined; // null = create mode
  onSave: (data: Partial<CodingSystem>) => void;
  isSaving?: boolean;
}

export function CodingSystemDialog({
  open,
  onOpenChange,
  system,
  onSave,
  isSaving,
}: CodingSystemDialogProps) {
  const [form, setForm] = useState<Partial<CodingSystem>>({});

  useEffect(() => {
    if (open) {
      if (system) {
        setForm({
          system_code: system.system_code,
          system_name: system.system_name,
          system_uri: system.system_uri,
          system_version: system.system_version,
          system_type: system.system_type,
          description: system.description,
          owner: system.owner,
        });
      } else {
        setForm({
          system_code: "",
          system_name: "",
          system_uri: "",
          system_version: "",
          system_type: "local",
          description: "",
          owner: "",
        });
      }
    }
  }, [open, system]);

  const isEdit = system !== undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md p-0 m-0 gap-0">
        <SheetHeader className="px-4 pt-4 m-0 pb-2 border-b">
          <SheetTitle>
            {isEdit ? "Edit Coding System" : "New Coding System"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update the coding system properties"
              : "Create a new coding system / vocabulary"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-2 mt-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center space-x-2">
            <Label htmlFor="sys_code" className="min-w-30">
              System Code *
            </Label>
            <Input
              id="sys_code"
              value={form.system_code ?? ""}
              onChange={(e) =>
                setForm({ ...form, system_code: e.target.value })
              }
              placeholder="e.g., LOINC"
              disabled={isEdit}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="sys_name" className="min-w-30">
              System Name *
            </Label>
            <Input
              id="sys_name"
              value={form.system_name ?? ""}
              onChange={(e) =>
                setForm({ ...form, system_name: e.target.value })
              }
              placeholder="e.g., Logical Observation Identifiers Names and Codes"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="sys_type" className="min-w-30">
              Type
            </Label>
            <Select
              value={form.system_type ?? "local"}
              onValueChange={(val) => setForm({ ...form, system_type: val })}
            >
              <SelectTrigger id="sys_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="local">Local</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="sys_version" className="min-w-30">
              Version
            </Label>
            <Input
              id="sys_version"
              value={form.system_version ?? ""}
              onChange={(e) =>
                setForm({ ...form, system_version: e.target.value })
              }
              placeholder="e.g., 2.78"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="sys_uri" className="min-w-30">
              URI
            </Label>
            <Input
              id="sys_uri"
              value={form.system_uri ?? ""}
              onChange={(e) => setForm({ ...form, system_uri: e.target.value })}
              placeholder="e.g., http://loinc.org"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="sys_owner" className="min-w-30">
              Owner
            </Label>
            <Input
              id="sys_owner"
              value={form.owner ?? ""}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              placeholder="e.g., Regenstrief Institute"
            />
          </div>

          <div className="flex items-start space-x-2">
            <Label htmlFor="sys_desc" className="min-w-30 pt-3">
              Description
            </Label>
            <Input
              id="sys_desc"
              className="flex w-full rounded-md border border-input bg-background "
              value={form.description ?? ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Description of this coding system"
            />
          </div>
        </div>

        <div className="w-full flex gap-2 p-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.system_code || !form.system_name || isSaving}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
