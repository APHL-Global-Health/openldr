import { useEffect, useRef, useState } from "react";
import type { Plugin } from "@/types/plugin-test.types";
import { StatusBadge } from "./StatusBadge";

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
        <span className="font-mono text-[9px] text-slate-700">
          {String(index).padStart(2, "0")}
        </span>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
        <span className="flex-1 font-mono text-[9px] uppercase tracking-[2px] text-slate-500">
          {label}
        </span>
      </div>

      <div className="flex gap-1">
        <div className="relative flex-1">
          <button
            onClick={() => setOpen((o) => !o)}
            className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition hover:border-slate-600
              ${
                selected
                  ? `border-slate-700 ${borderSelectedClass} bg-slate-900`
                  : "border-slate-800 bg-[#080d14]"
              }`}
          >
            {selected ? (
              <div>
                <p className="font-mono text-[11px] text-slate-200">
                  {selected.name}
                </p>
                <p className="font-mono text-[9px] text-slate-500">
                  v{selected.version}
                </p>
              </div>
            ) : (
              <span className="font-mono text-[11px] italic text-slate-600">
                No plugin selected
              </span>
            )}
            <div className="flex items-center gap-2">
              {selected && <StatusBadge status={selected.status} />}
              <span className="text-[8px] text-slate-600">
                {open ? "▲" : "▼"}
              </span>
            </div>
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
              <p className="border-b border-slate-800 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[2px] text-slate-700">
                Select Plugin
              </p>
              {plugins.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between border-l-2 px-3 py-2 text-left transition hover:bg-slate-800
                    ${
                      p.id === selectedId
                        ? "border-l-sky-500 bg-sky-500/10"
                        : "border-transparent"
                    }`}
                >
                  <div>
                    <p className="font-mono text-[11px] text-slate-300">
                      {p.name}
                    </p>
                    <p className="font-mono text-[9px] text-slate-500">
                      v{p.version}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onAdd}
          title={`New ${label} plugin`}
          className="flex w-7 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-[#080d14] text-base text-slate-600 transition hover:border-sky-500 hover:text-sky-400"
        >
          +
        </button>
      </div>
    </div>
  );
}
