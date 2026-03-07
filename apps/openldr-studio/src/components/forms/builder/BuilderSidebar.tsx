import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useFormBuilderStore, useActiveForm } from "@/store/formBuilderStore";
import { FieldCard } from "./FieldCard";
import { AddFieldPanel } from "./AddFieldPanel";
import { FormSelector } from "./FormSelector";
import { Button } from "./ui";

export const BuilderSidebar: React.FC = () => {
  const {
    forms,
    activeFormId,
    setActiveFormId,
    createForm,
    deleteForm,
    addField,
    removeField,
    updateField,
    reorderFields,
    toggleFieldExpanded,
  } = useFormBuilderStore();

  const activeForm = useActiveForm();
  const [showAddPanel, setShowAddPanel] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeForm) return;
    const oldIndex = activeForm.fields.findIndex((f) => f.id === active.id);
    const newIndex = activeForm.fields.findIndex((f) => f.id === over.id);
    reorderFields(arrayMove(activeForm.fields, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top section (sticky) ── */}
      <div className="flex-shrink-0 p-4 border-b border-[#1E2E42] space-y-4">
        <FormSelector
          forms={forms}
          activeId={activeFormId}
          onSelect={setActiveFormId}
          onCreate={(name) => createForm(name)}
          onDelete={deleteForm}
        />
      </div>

      {/* ── Fields header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#1E2E42]">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#607A94]">
          Fields {activeForm ? `(${activeForm.fields.length})` : ""}
        </span>
        {activeForm && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowAddPanel((v) => !v)}
          >
            <span className="text-base leading-none">+</span>
            Add Field
          </Button>
        )}
      </div>

      {/* ── Add panel (inline) ── */}
      {showAddPanel && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-[#1E2E42]">
          <AddFieldPanel
            inline
            onAdd={(type) => {
              addField(type);
            }}
            onClose={() => setShowAddPanel(false)}
          />
        </div>
      )}

      {/* ── Field list (scrollable) ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {!activeForm && (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-[#3A5068]">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M9 12h6M12 9v6" />
            </svg>
            <p className="text-sm">Select or create a form above</p>
          </div>
        )}

        {activeForm && activeForm.fields.length === 0 && !showAddPanel && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-[#3A5068]">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M8 10h8M8 14h5" />
            </svg>
            <p className="text-sm font-medium">No fields yet</p>
            <p className="text-xs">Click "+ Add Field" to start building</p>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeForm?.fields.map((f) => f.id) ?? []}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {activeForm?.fields.map((field) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  onUpdate={(patch) => updateField(field.id, patch)}
                  onRemove={() => removeField(field.id)}
                  onToggleExpand={() => toggleFieldExpanded(field.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
