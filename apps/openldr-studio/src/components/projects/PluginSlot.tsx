import { useEffect, useRef, useState } from "react";
import type { Plugin } from "@/types/plugin-test.types";
import { StatusBadge } from "./StatusBadge";
import { Button } from "../ui/button";

// ── Plugin Slot ───────────────────────────────────────────────────────────────
interface PluginSlotProps {
  index: number;
  label: string;
  dotClass: string;
  borderSelectedClass: string;
  plugins: Plugin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function PluginSlot({
  index,
  label,
  dotClass,
  borderSelectedClass,
  plugins,
  selectedId,
  onSelect,
  onAdd,
}: PluginSlotProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = plugins.find((p) => p.id === selectedId);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="mb-1.5 px-2" ref={ref}>
      {/* Slot header */}
      <div className="mb-1 flex items-center gap-1.5 px-1">
        <span className="font-mono text-[9px]">
          {String(index).padStart(2, "0")}
        </span>
        {/* <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} /> */}
        <span className="flex-1 font-mono text-[9px] uppercase tracking-[2px] ">
          {label}
        </span>
      </div>

      <div className="flex gap-1">
        <div className="relative flex-1">
          <Button
            variant="ghost"
            onClick={() => setOpen((o) => !o)}
            className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition
              ${
                ""
                // selected
                //   ? `border-slate-700 ${borderSelectedClass} bg-slate-900`
                //   : "border-border bg-[#080d14]"
              }`}
          >
            {selected ? (
              <div>
                <p className="font-mono text-[11px] ">{selected.name}</p>
                <p className="font-mono text-[9px] ">v{selected.version}</p>
              </div>
            ) : (
              <span className="font-mono text-[11px] italic ">
                No plugin selected
              </span>
            )}
            <div className="flex items-center gap-2">
              {selected && <StatusBadge status={selected.status} />}
              <span className="text-[8px] ">{open ? "▲" : "▼"}</span>
            </div>
          </Button>

          {open && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border border-border bg-slate-900 shadow-xl">
              <p className="border-b border-border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[2px] text-slate-700">
                Select Plugin
              </p>
              {plugins.map((p) => (
                <Button
                  variant="ghost"
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between border-l-2 px-3 py-2 text-left transition hover:bg-slate-800
                    ${p.id === selectedId ? "" : "border-transparent"}`}
                >
                  <div>
                    <p className="font-mono text-[11px] text-slate-300">
                      {p.name}
                    </p>
                    <p className="font-mono text-[9px] ">v{p.version}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          onClick={onAdd}
          title={`New ${label} plugin`}
          className="flex w-7 shrink-0 items-center justify-center rounded-md border border-border text-base transition"
        >
          +
        </Button>
      </div>
    </div>
  );
}
