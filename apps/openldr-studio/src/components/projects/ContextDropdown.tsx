import { useEffect, useRef, useState } from "react";

// ── Context Dropdown ──────────────────────────────────────────────────────────
interface ContextItem {
  id: string;
  name: string;
}
interface ContextDropdownProps {
  label: string;
  accentClass: string; // tailwind border/text color for selected state
  items: ContextItem[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ContextDropdown({
  label,
  accentClass,
  items,
  selectedId,
  disabled,
  onSelect,
  onAdd,
}: ContextDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.id === selectedId);

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="mb-1 px-2">
      <p className="mb-1 px-1 font-mono text-[9px] uppercase tracking-[2px] text-slate-600">
        {label}
      </p>
      <div className="flex gap-1" ref={ref}>
        <div className="relative flex-1">
          <button
            disabled={disabled}
            onClick={() => !disabled && setOpen((o) => !o)}
            className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition
              ${
                disabled
                  ? "cursor-not-allowed opacity-30"
                  : "cursor-pointer hover:border-slate-600"
              }
              ${
                selected
                  ? `border-slate-700 bg-slate-900`
                  : "border-slate-800 bg-[#080d14]"
              }`}
          >
            <span
              className={`font-mono text-[11px] ${
                selected ? "text-slate-200" : "italic text-slate-600"
              }`}
            >
              {selected?.name ??
                (disabled ? "— select parent first —" : "Select…")}
            </span>
            {!disabled && (
              <span className="ml-1 text-[8px] text-slate-600">
                {open ? "▲" : "▼"}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
              {items.length === 0 ? (
                <p className="px-3 py-2.5 font-mono text-[11px] italic text-slate-600">
                  No items — create one →
                </p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelect(item.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center border-l-2 px-3 py-2 text-left transition hover:bg-slate-800
                      ${
                        item.id === selectedId
                          ? `border-l-sky-500 bg-sky-500/10`
                          : "border-transparent"
                      }`}
                  >
                    <span className="font-mono text-[12px] text-slate-300">
                      {item.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={onAdd}
          disabled={disabled}
          title={`New ${label}`}
          className={`flex w-7 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-[#080d14] text-base text-slate-600 transition
            ${
              disabled
                ? "cursor-not-allowed opacity-20"
                : `hover:border-sky-500 hover:text-sky-400`
            }`}
        >
          +
        </button>
      </div>
    </div>
  );
}
