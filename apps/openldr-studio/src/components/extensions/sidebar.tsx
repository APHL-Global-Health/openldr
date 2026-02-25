import { useExtensions } from "@/hooks/misc/useExtensions";
import { useCallback, useState } from "react";
// import { types } from "@openldr/extensions";
import { type ExtensionState } from "@/types/extensions";
import {
  AlertTriangle,
  ChevronDown,
  Layers,
  Loader2,
  Unplug,
} from "lucide-react";
import { Badge } from "@/components/extensions/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { injectBridge } from "@/lib/extensions";
import { useKeycloakClient } from "../react-keycloak-provider";

const STATE_BADGE: Record<
  string,
  "default" | "active" | "error" | "warning" | "fetching"
> = {
  inactive: "default",
  fetching: "fetching",
  "pending-permission": "warning",
  activating: "warning",
  active: "active",
  error: "error",
};

const STATE_DOT: Record<string, string> = {
  inactive: "bg-[#2d3652] border-border",
  active: "bg-[#34d399] border-border shadow-[0_0_6px_#34d39960]",
  error: "bg-[#f87171] border-border",
  fetching: "bg-[#a78bfa] border-border animate-pulse-dot",
  activating: "bg-[#f59e0b] border-border animate-pulse-dot",
  "pending-permission": "bg-[#f59e0b] border-border",
};

const ENV = import.meta.env;

export function ExtensionSidebar() {
  const client = useKeycloakClient();
  const { state, dispatch, host, loader } = useExtensions();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExtension = useCallback(
    async (ext: ExtensionState) => {
      if (ext.state === "active") {
        host.deactivate(ext.id);
        return;
      }
      if (ext.state === "fetching" || ext.state === "activating") return;

      dispatch({
        type: "EXT_STATE",
        payload: { extId: ext.id, state: "fetching" },
      });
      try {
        const codeResp = await loader.fetchAndVerifyPayload(ext);
        await new Promise<void>((resolve, reject) => {
          dispatch({
            type: "SET_PERMISSION_PROMPT",
            payload: {
              extId: ext.id,
              permissions: ext.permissions,
              resolve,
              reject,
            },
          });
        });
        if (ext.kind === "worker") {
          await host.loadWorkerExtension(ext, codeResp.payload);
        } else {
          const htmlWithBridge = injectBridge(
            codeResp.payload,
            ext.id,
            ENV.VITE_API_BASE_URL,
            client.kc.token ?? "",
          );
          dispatch({
            type: "EXT_STATE",
            payload: { extId: ext.id, payload: htmlWithBridge },
          });
          host.loadIframeExtension(ext);
        }
      } catch (err: unknown) {
        const msg = (err as Error).message;
        if (!msg || msg === "undefined") {
          dispatch({
            type: "EXT_STATE",
            payload: { extId: ext.id, state: "inactive" },
          });
        } else {
          dispatch({
            type: "EXT_STATE",
            payload: { extId: ext.id, state: "error", error: msg },
          });
          dispatch({
            type: "ADD_NOTIFICATION",
            payload: {
              message: `Failed to load "${ext.name}": ${msg}`,
              kind: "error",
              extId: ext.id,
            },
          });
        }
      }
    },
    [host, loader, dispatch],
  );

  const activeCount = state.extensions.filter(
    (e) => e.state === "active",
  ).length;

  if (state.extensions.length > 0) {
    // console.log(state.extensions);
  }

  return (
    <aside className="min-w-64 max-w-64  flex flex-1 flex-col ">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-border border-b">
        <div className="flex items-center gap-2">
          <span className="label-caps">Extensions</span>
        </div>
        <Badge variant={activeCount > 0 ? "active" : "default"}>
          {activeCount}/{state.extensions.length}
        </Badge>
      </div>

      {state.extensions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]">
          <Unplug className="h-7 w-7 " />
          <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
            No extensions loaded
            <br />
            Check registry connection
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {state.extensions.map((ext) => (
            <div key={ext.id} className="border-b border-border">
              {/* row */}
              <div className="group flex items-center gap-2 px-3 py-2.5 hover:bg-secondary transition-colors">
                <span className="text-lg leading-none shrink-0 cursor-default">
                  {ext.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium  truncate cursor-default">
                    {ext.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        STATE_DOT[ext.state] || "",
                      )}
                    />
                    <Badge
                      variant={STATE_BADGE[ext.state] || "default"}
                      className="text-[9px] cursor-default border-border"
                    >
                      {ext.state === "pending-permission"
                        ? "awaiting"
                        : ext.state}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {(ext.state === "fetching" || ext.state === "activating") && (
                    <Loader2 className="h-3 w-3 text-[#a78bfa] animate-spin" />
                  )}
                  <Switch
                    checked={ext.state === "active"}
                    disabled={
                      ext.state === "fetching" || ext.state === "activating"
                    }
                    onCheckedChange={() => toggleExtension(ext)}
                  />
                  <button
                    onClick={() =>
                      setExpanded(expanded === ext.id ? null : ext.id)
                    }
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-[#475569]"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-150",
                        expanded === ext.id && "rotate-180",
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* error inline */}
              {ext.error && (
                <div className="flex items-start gap-2 mx-3 mb-2 px-2 py-1.5 rounded bg-red-950/30 border border-red-900/40">
                  <AlertTriangle className="h-3 w-3 text-[#f87171] shrink-0 mt-0.5" />
                  <p className="text-[10px] font-mono text-[#f87171] break-all leading-snug">
                    {ext.error}
                  </p>
                </div>
              )}

              {/* expanded detail */}
              {expanded === ext.id && (
                <div className="px-3 pb-3 pt-2 border-t border-border space-y-2.5">
                  <p className="text-[11px] text-[#475569] leading-relaxed cursor-default">
                    {ext.description}
                  </p>
                  <div>
                    <p className="label-caps mb-1.5 cursor-default">
                      Permissions
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {ext.permissions.map((p) => (
                        <Badge
                          key={p}
                          variant="default"
                          className="text-[9px] cursor-default"
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="label-caps mb-1 cursor-default">
                      Integrity hash
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[9px] font-mono truncate cursor-default">
                          {ext.integrity.slice(0, 28)}…
                        </p>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="border-border border shadow"
                      >
                        {ext.integrity}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          ))}
        </ScrollArea>
      )}
    </aside>
  );
}
