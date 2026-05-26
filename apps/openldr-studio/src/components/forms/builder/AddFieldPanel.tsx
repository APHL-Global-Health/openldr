import React from "react";
import type { FieldType } from "@/types/forms";
import { FIELD_TYPE_META } from "@/lib/constants";

interface AddFieldPanelProps {
  onAdd: (type: FieldType) => void;
  onClose: () => void;
  inline?: boolean;
}

export const AddFieldPanel: React.FC<AddFieldPanelProps> = ({
  onAdd,
  onClose,
  inline = false,
}) => {
  const list = (
    <div className="flex flex-col">
      {FIELD_TYPE_META.map((meta) => (
        <button
          key={meta.type}
          onClick={() => {
            onAdd(meta.type);
            onClose();
          }}
          className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-accent/50 text-left group"
        >
          <span
            className="flex items-center justify-center w-7 h-7 rounded-md text-sm font-bold shrink-0"
            style={{
              background: meta.color + "18",
              color: meta.color,
            }}
          >
            {meta.icon}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{meta.label}</span>
            <span className="ml-2 text-[11px] text-muted-foreground">
              {meta.description}
            </span>
          </div>
        </button>
      ))}
    </div>
  );

  if (inline) {
    return (
      <div className="p-1">
        {/* <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#6EE7B7]">
            Choose Field Type
          </span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div> */}
        {list}
      </div>
    );
  }

  // Mobile bottom sheet style
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="bg-card rounded-t-2xl p-4 pb-8 border-t border-border">
        <div className="w-9 h-1 bg-muted rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-2 px-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#6EE7B7]">
            Add Field
          </span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>
        {list}
      </div>
    </div>
  );
};
