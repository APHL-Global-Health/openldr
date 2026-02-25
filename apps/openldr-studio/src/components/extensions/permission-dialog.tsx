import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useExtensions } from "@/hooks/misc/useExtensions";

import {
  SearchIcon,
  FolderDown,
  Shield,
  Hash,
  ShieldAlert,
  Check,
  Database,
  Eye,
  Activity,
  Zap,
  Terminal,
  Command,
  GitBranch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/extensions/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export const PERM_META: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  "data.query": {
    label: "Execute SQL queries against the lab database",
    icon: <Database className="h-3 w-3" />,
  },
  "data.specimens": {
    label: "Read specimen records",
    icon: <Eye className="h-3 w-3" />,
  },
  "data.resistanceStats": {
    label: "Read AMR resistance statistics",
    icon: <Activity className="h-3 w-3" />,
  },
  "storage.read": {
    label: "Read from extension persistent storage",
    icon: <Hash className="h-3 w-3" />,
  },
  "storage.write": {
    label: "Write to extension persistent storage",
    icon: <Hash className="h-3 w-3" />,
  },
  "ui.notifications": {
    label: "Show toast notifications",
    icon: <Zap className="h-3 w-3" />,
  },
  "ui.statusBar": {
    label: "Update the status bar",
    icon: <Terminal className="h-3 w-3" />,
  },
  "ui.commands": {
    label: "Register command palette commands",
    icon: <Command className="h-3 w-3" />,
  },
  "events.emit": {
    label: "Emit cross-extension events",
    icon: <GitBranch className="h-3 w-3" />,
  },
  "events.subscribe": {
    label: "Subscribe to application events",
    icon: <GitBranch className="h-3 w-3" />,
  },
};

export function PermissionPromptDialog() {
  const { state, dispatch } = useExtensions();
  const p = state.permissionPrompt;
  const ext = p ? state.extensions.find((e) => e.id === p.extId) : null;

  return (
    <Dialog open={!!p}>
      <DialogContent
        className="max-w-115 p-0 m-0 rounded-sm"
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-0 pt-4">
          <div className="flex items-start gap-3 pr-6">
            <span className="text-2xl leading-none mt-0.5">{ext?.icon}</span>
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {ext?.name}
                <Badge variant="default">v{ext?.version}</Badge>
              </DialogTitle>
              <DialogDescription>{ext?.author}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-60 border-t border-b border-border">
          <div className="px-0 py-0">
            {p?.permissions.map((perm) => {
              const meta = PERM_META[perm] || {
                label: perm,
                icon: <Hash className="h-3 w-3" />,
              };
              return (
                <div
                  key={perm}
                  className="flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-0"
                >
                  <span className="mt-0.5 shrink-0">{meta.icon}</span>
                  <div>
                    <p className="text-[11px] font-mono  mb-0.5">{perm}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {meta.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row justify-between items-center gap-4 px-4 py-0 pb-4 m-0 ">
          {/* <p className="text-[10px]  flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3  shrink-0" />
            Runs sandboxed — no DOM or cookie access
          </p> */}

          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="rounded-sm"
              onClick={() => {
                p?.resolve();
                dispatch({ type: "SET_PERMISSION_PROMPT", payload: null });
              }}
            >
              Load
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-sm"
              onClick={() => {
                p?.reject();
                dispatch({ type: "SET_PERMISSION_PROMPT", payload: null });
              }}
            >
              Deny
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
