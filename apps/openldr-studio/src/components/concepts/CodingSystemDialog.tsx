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

interface CodingSystemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  system: CodingSystem | null; // null = create mode
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

  const isEdit = system !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Coding System" : "New Coding System"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the coding system properties"
              : "Create a new coding system / vocabulary"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sys_code">System Code *</Label>
            <Input
              id="sys_code"
              value={form.system_code ?? ""}
              onChange={(e) => setForm({ ...form, system_code: e.target.value })}
              placeholder="e.g., LOINC"
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sys_name">System Name *</Label>
            <Input
              id="sys_name"
              value={form.system_name ?? ""}
              onChange={(e) => setForm({ ...form, system_name: e.target.value })}
              placeholder="e.g., Logical Observation Identifiers Names and Codes"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sys_type">Type</Label>
              <Select
                value={form.system_type ?? "local"}
                onValueChange={(val) => setForm({ ...form, system_type: val })}
              >
                <SelectTrigger id="sys_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sys_version">Version</Label>
              <Input
                id="sys_version"
                value={form.system_version ?? ""}
                onChange={(e) => setForm({ ...form, system_version: e.target.value })}
                placeholder="e.g., 2.78"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sys_uri">URI</Label>
            <Input
              id="sys_uri"
              value={form.system_uri ?? ""}
              onChange={(e) => setForm({ ...form, system_uri: e.target.value })}
              placeholder="e.g., http://loinc.org"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sys_desc">Description</Label>
            <textarea
              id="sys_desc"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description of this coding system"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sys_owner">Owner</Label>
            <Input
              id="sys_owner"
              value={form.owner ?? ""}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              placeholder="e.g., Regenstrief Institute"
            />
          </div>
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
