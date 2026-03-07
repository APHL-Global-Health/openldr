import React from "react";
import type { FieldType } from "@/types/forms";
import { FIELD_TYPE_META } from "@/lib/constants";

interface AddFieldPanelProps {
  onAdd: (type: FieldType) => void;
  onClose: () => void;
  inline?: boolean; // if true, renders inline instead of as overlay
}

export const AddFieldPanel: React.FC<AddFieldPanelProps> = ({
  onAdd,
  onClose,
  inline = false,
}) => {
  if (inline) {
    return (
      <div className="rounded-xl border border-[#1E2E42] bg-[#111E30] p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#6EE7B7]">
            Choose Field Type
          </span>
          <button
            onClick={onClose}
            className="text-[#607A94] hover:text-[#E2EAF4] text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {FIELD_TYPE_META.map((meta) => (
            <button
              key={meta.type}
              onClick={() => {
                onAdd(meta.type);
                onClose();
              }}
              className="flex flex-col items-center gap-1.5 rounded-lg p-2.5 border transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: meta.color + "10",
                borderColor: meta.color + "30",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = meta.color + "66")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = meta.color + "30")
              }
            >
              <span
                className="text-xl font-bold font-mono"
                style={{ color: meta.color }}
              >
                {meta.icon}
              </span>
              <span className="text-[11px] font-semibold text-[#A0B4C8]">
                {meta.label}
              </span>
              <span className="text-[9px] text-[#4A6480] text-center leading-tight">
                {meta.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Mobile bottom sheet style
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="bg-[#111E30] rounded-t-2xl p-5 pb-8 border-t border-[#1E2E42]">
        <div className="w-9 h-1 bg-[#2A3F57] rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#6EE7B7]">
            Add Field
          </span>
          <button
            onClick={onClose}
            className="text-[#607A94] hover:text-[#E2EAF4] text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {FIELD_TYPE_META.map((meta) => (
            <button
              key={meta.type}
              onClick={() => {
                onAdd(meta.type);
                onClose();
              }}
              className="flex flex-col items-center gap-2 rounded-xl p-3 border transition-all cursor-pointer"
              style={{
                background: meta.color + "12",
                borderColor: meta.color + "30",
              }}
            >
              <span
                className="text-2xl font-bold font-mono"
                style={{ color: meta.color }}
              >
                {meta.icon}
              </span>
              <span className="text-xs font-semibold text-[#A0B4C8]">
                {meta.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
