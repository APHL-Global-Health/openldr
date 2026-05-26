import React, { useState, useRef, useEffect } from "react";
import type { FormDefinition } from "@/types/forms";

interface FormSelectorProps {
  forms: FormDefinition[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export const FormSelector: React.FC<FormSelectorProps> = ({
  forms,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const active = forms.find((f) => f.id === activeId);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const confirmCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName("");
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#607A94]">
        Form
      </span>

      {creating ? (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            placeholder="Form name..."
            className="flex-1 bg-[#0F1E2E] border border-[#6EE7B7]/50 text-[#E2EAF4] rounded-lg px-3 py-2 text-sm placeholder:text-[#3A5068] focus:border-[#6EE7B7] outline-none"
          />
          <button
            onClick={confirmCreate}
            className="bg-[#6EE7B7] text-[#0A1628] font-bold rounded-lg px-3 text-sm hover:bg-[#4ADE80] transition-colors"
          >
            ✓
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            className="bg-[#1A2C40] border border-[#2A3F57] text-[#607A94] rounded-lg px-3 text-sm hover:text-[#E2EAF4] transition-colors"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Dropdown */}
          <div className="relative flex-1" ref={dropdownRef}>
            <button
              onClick={() => setOpen(!open)}
              className="w-full flex items-center justify-between bg-[#0F1E2E] border border-[#2A3F57] text-[#E2EAF4] rounded-lg px-3 py-2 text-sm hover:border-[#4A6480] transition-colors focus:border-[#6EE7B7] outline-none"
            >
              <span className="truncate">
                {active?.name ?? "Select a form…"}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`ml-2 flex-shrink-0 text-[#4A6480] transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {open && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 rounded-xl border border-[#1E2E42] bg-[#111E30] shadow-2xl overflow-hidden">
                {forms.length === 0 && (
                  <p className="text-[#4A6480] text-xs px-3 py-3">
                    No forms yet
                  </p>
                )}
                {forms.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center group/item hover:bg-white/5 transition-colors"
                  >
                    <button
                      onClick={() => {
                        onSelect(f.id);
                        setOpen(false);
                      }}
                      className="flex-1 text-left px-3 py-2.5 text-sm cursor-pointer"
                      style={{
                        color: f.id === activeId ? "#6EE7B7" : "#C0D0E0",
                      }}
                    >
                      <span className="font-medium">{f.name}</span>
                      {f.description && (
                        <span className="block text-[10px] text-[#4A6480] mt-0.5 truncate">
                          {f.description}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        onDelete(f.id);
                        setOpen(false);
                      }}
                      className="opacity-0 group-hover/item:opacity-100 px-3 py-2.5 text-[#4A6480] hover:text-red-400 transition-all text-xs"
                      title="Delete form"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="border-t border-[#1E2E42]">
                  <button
                    onClick={() => {
                      setOpen(false);
                      setCreating(true);
                    }}
                    className="w-full text-left px-3 py-2.5 text-[#6EE7B7] text-sm font-semibold hover:bg-[#6EE7B7]/10 transition-colors flex items-center gap-2"
                  >
                    <span className="text-lg leading-none">+</span> New form
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick create button */}
          <button
            onClick={() => setCreating(true)}
            title="New form"
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#1A2C40] border border-[#2A3F57] text-[#6EE7B7] hover:bg-[#6EE7B7]/10 hover:border-[#6EE7B7]/40 transition-all text-xl leading-none"
          >
            +
          </button>
        </div>
      )}

      {/* Meta edit row */}
      {active && !creating && (
        <input
          value={active.description ?? ""}
          onChange={() => {}}
          placeholder="Form description (optional)…"
          className="bg-transparent border-0 border-b border-[#1E2E42] text-[#607A94] text-xs px-0 py-1 focus:border-[#2A3F57] outline-none placeholder:text-[#2A3F57] focus:text-[#A0B4C8] transition-colors"
          readOnly
        />
      )}
    </div>
  );
};
