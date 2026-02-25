import { useExtensions } from "@/hooks/misc/useExtensions";
import { cn } from "@/lib/utils";
import { STATE_DOT, type ExtensionState } from "@/types/extensions";
import { ChevronRight, Loader2, Package, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ExtensionListPanel() {
  const { state, dispatch } = useExtensions();
  const [search, setSearch] = useState("");

  const filtered = state.extensions.filter(
    (e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.author.toLowerCase().includes(search.toLowerCase()),
  );

  const groups = {
    active: filtered.filter((e) => e.state === "active"),
    error: filtered.filter((e) => e.state === "error"),
    inactive: filtered.filter(
      (e) => e.state !== "active" && e.state !== "error",
    ),
  };

  const ExtRow = ({ ext }: { ext: ExtensionState }) => {
    const selected = state.selectedExtId === ext.id;
    return (
      <Button
        variant="ghost"
        onClick={() =>
          dispatch({ type: "SELECT_EXT", payload: selected ? null : ext.id })
        }
        className={cn(
          "w-full flex items-center  hover:text-foreground gap-2.5 px-3 py-6 border-border border-b text-left transition-colors duration-100 group rounded-none",
          selected ? "bg-secondary" : "",
        )}
      >
        <span className="text-base leading-none shrink-0">{ext.icon}</span>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-[12px] font-medium truncate leading-snug",
              selected ? "text-foreground" : "",
            )}
          >
            {ext.name}
          </p>
          <p
            className={cn(
              "text-[10px] truncate mt-0.5 text-muted-foreground",
              selected ? "text-foreground" : "",
            )}
          >
            {ext.author} · v{ext.version}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(ext.state === "fetching" || ext.state === "activating") && (
            <Loader2 className="h-3 w-3 text-[#a78bfa] animate-spin" />
          )}
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all",
              STATE_DOT[ext.state] || "",
            )}
          />
          {selected && <ChevronRight className="h-3 w-3" />}
        </div>
      </Button>
    );
  };

  const Section = ({
    label,
    items,
    count,
  }: {
    label: string;
    items: ExtensionState[];
    count: number;
  }) => {
    if (items.length === 0) return null;
    return (
      <>
        <div className="px-3 pt-3 pb-1 flex items-center justify-between border-b border-border">
          <span className="label-caps">{label}</span>
          <span className="text-[10px] font-mono">{count}</span>
        </div>
        {items.map((ext) => (
          <ExtRow key={ext.id} ext={ext} />
        ))}
      </>
    );
  };

  return (
    <div className="min-w-56 max-w-56 shrink-0  min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] flex flex-1 flex-col border-border border-r">
      <div className="px-3 pt-3 pb-2.5 border-b border-border">
        {/* <p className="label-caps mb-2">Extensions</p> */}
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full border border-border rounded-xs px-2.5 py-1.5 text-[11px] font-mono text-[#94a3b8]  focus:outline-none focus:border-primary/40 transition-colors pr-7"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#2d3652] hover:text-[#475569]"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        {state.extensions.length === 0 ? (
          <div className="flex justify-center flex-col items-center gap-2 py-12 px-4 text-center">
            <Package className="h-7 w-7 " />
            <p className="text-[10px] font-mono  leading-relaxed">
              No extensions
              <br />
              Check registry connection
            </p>
          </div>
        ) : (
          <>
            <Section
              label="Installed"
              items={groups.active}
              count={groups.active.length}
            />
            <Section
              label="Error"
              items={groups.error}
              count={groups.error.length}
            />
            <Section
              label="Available"
              items={groups.inactive}
              count={groups.inactive.length}
            />
          </>
        )}
      </div>
    </div>
  );
}
