import { ContentLayout } from "@/components/admin-panel/content-layout";

import { useExtensions } from "@/hooks/misc/useExtensions";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function LogsPage() {
  const { state, dispatch } = useExtensions();
  const [filter, setFilter] = useState("all");

  const extIds = [...new Set(state.logs.map((l) => l.extId))];
  const logs = state.logs.filter((l) => filter === "all" || l.extId === filter);

  const DIR_COLOR: Record<string, string> = {
    in: "text-primary",
    out: "text-primary",
    host: "text-primary",
  };

  const navComponents = () => {
    return <h1 className="font-bold">Logs</h1>;
  };
  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <div className="flex flex-col w-full  h-full overflow-auto min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]">
          {/* console header */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
            <div className="flex gap-1 ml-2">
              {["all", ...extIds].map((id) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-mono rounded border transition-colors",
                    filter === id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border ",
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <span className="text-[10px] font-mono ">{state.logs.length}</span>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="font-mono text-[10px]">
              {logs.length === 0 && (
                <p className="py-6 text-center ">
                  No IPC messages yet — enable an extension to start
                </p>
              )}
              {logs.slice(0, 120).map((log) => (
                <div
                  key={String(log.id)}
                  className="flex items-baseline gap-2 px-3 py-0.5 cursor-default border-b border-border"
                >
                  <span className=" shrink-0 w-16">{log.ts}ms</span>
                  <span
                    className={cn(
                      "shrink-0 w-8",
                      DIR_COLOR[log.direction] || "",
                    )}
                  >
                    {log.direction}
                  </span>
                  <span className=" shrink-0 w-28 truncate">{log.extId}</span>
                  <span className="text-muted-foreground">
                    {String(log.event)}
                  </span>
                  {Array.isArray(log.args) && log.args.length > 0 && (
                    <span className=" truncate">
                      {JSON.stringify(log.args).slice(0, 80)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* <div className="min-h-48 max-h-48 shrink-0 border-t border-border bg-card flex flex-col">
           
          </div> */}
        </div>
      </div>
    </ContentLayout>
  );
}

export default LogsPage;
