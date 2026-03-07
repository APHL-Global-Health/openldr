import { useEffect, useRef, useState } from "react";

// ── Create Modal ──────────────────────────────────────────────────────────────
interface CreateModalProps {
  title: string;
  placeholder: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export function CreateModal({
  title,
  placeholder,
  onConfirm,
  onClose,
}: CreateModalProps) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-72 rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[3px] text-slate-400">
          {title}
        </p>
        <input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) onConfirm(val.trim());
            if (e.key === "Escape") onClose();
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-700 py-2 font-mono text-[11px] text-slate-500 transition hover:border-slate-500"
          >
            Cancel
          </button>
          <button
            onClick={() => val.trim() && onConfirm(val.trim())}
            disabled={!val.trim()}
            className="flex-1 rounded-lg bg-gradient-to-r from-sky-600 to-violet-600 py-2 font-mono text-[11px] text-white transition disabled:cursor-not-allowed disabled:opacity-30"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
