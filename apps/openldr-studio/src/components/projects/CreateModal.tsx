import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

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
        className="w-72 rounded-sm border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4  text-[10px] uppercase tracking-[3px] text-slate-400">
          {title}
        </p>
        <Input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) onConfirm(val.trim());
            if (e.key === "Escape") onClose();
          }}
          placeholder={placeholder}
          className="w-full rounded-sm border border-border bg-slate-950 px-3 py-2  text-xs"
        />
        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 rounded-sm border border-border  py-2  text-[11px]"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={() => val.trim() && onConfirm(val.trim())}
            disabled={!val.trim()}
            className="flex-1 rounded-sm border border-border py-2  text-[11px]  transition disabled:cursor-not-allowed disabled:opacity-30"
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
