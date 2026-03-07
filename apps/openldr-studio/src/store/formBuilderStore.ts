import { create } from "zustand";
import type { FormDefinition, FormField, FieldType } from "@/types/forms";
import { SAMPLE_FORMS } from "@/lib/constants";
import { generateKey } from "@/lib/schema";

interface FormBuilderState {
  forms: FormDefinition[];
  activeFormId: string | null;

  // Actions
  setActiveFormId: (id: string) => void;
  createForm: (name: string, description?: string) => void;
  deleteForm: (id: string) => void;
  updateFormMeta: (id: string, name: string, description?: string) => void;

  addField: (type: FieldType) => void;
  removeField: (fieldId: string) => void;
  updateField: (fieldId: string, patch: Partial<FormField>) => void;
  reorderFields: (fields: FormField[]) => void;
  toggleFieldExpanded: (fieldId: string) => void;

  importFromSchema: (schemaJson: string) => { ok: boolean; error?: string };
}

/** Derive activeForm outside the store so it reacts to state changes. */
export const useActiveForm = () =>
  useFormBuilderStore((s) => s.forms.find((f) => f.id === s.activeFormId) ?? null);

export const useFormBuilderStore = create<FormBuilderState>((set, get) => ({
  forms: SAMPLE_FORMS,
  activeFormId: SAMPLE_FORMS[0].id,

  setActiveFormId: (id) => set({ activeFormId: id }),

  createForm: (name, description) => {
    const newForm: FormDefinition = {
      id: `form-${Date.now()}`,
      name,
      description,
      fields: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({ forms: [...s.forms, newForm], activeFormId: newForm.id }));
  },

  deleteForm: (id) => {
    set((s) => {
      const forms = s.forms.filter((f) => f.id !== id);
      return {
        forms,
        activeFormId: forms.length > 0 ? forms[0].id : null,
      };
    });
  },

  updateFormMeta: (id, name, description) => {
    set((s) => ({
      forms: s.forms.map((f) =>
        f.id === id ? { ...f, name, description, updatedAt: Date.now() } : f,
      ),
    }));
  },

  addField: (type) => {
    const { activeFormId } = get();
    if (!activeFormId) return;
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type,
      label: "",
      key: "",
      required: false,
      expanded: true,
    };
    set((s) => ({
      forms: s.forms.map((f) =>
        f.id === activeFormId
          ? { ...f, fields: [...f.fields, newField], updatedAt: Date.now() }
          : f,
      ),
    }));
  },

  removeField: (fieldId) => {
    const { activeFormId } = get();
    if (!activeFormId) return;
    set((s) => ({
      forms: s.forms.map((f) =>
        f.id === activeFormId
          ? {
              ...f,
              fields: f.fields.filter((x) => x.id !== fieldId),
              updatedAt: Date.now(),
            }
          : f,
      ),
    }));
  },

  updateField: (fieldId, patch) => {
    const { activeFormId } = get();
    if (!activeFormId) return;
    set((s) => ({
      forms: s.forms.map((f) => {
        if (f.id !== activeFormId) return f;
        return {
          ...f,
          updatedAt: Date.now(),
          fields: f.fields.map((x) => {
            if (x.id !== fieldId) return x;
            const updated = { ...x, ...patch };
            // auto-generate key from label if key is empty
            if (patch.label !== undefined && !x.key) {
              updated.key = generateKey(patch.label);
            }
            return updated;
          }),
        };
      }),
    }));
  },

  reorderFields: (fields) => {
    const { activeFormId } = get();
    if (!activeFormId) return;
    set((s) => ({
      forms: s.forms.map((f) =>
        f.id === activeFormId ? { ...f, fields, updatedAt: Date.now() } : f,
      ),
    }));
  },

  toggleFieldExpanded: (fieldId) => {
    const { activeFormId } = get();
    if (!activeFormId) return;
    set((s) => ({
      forms: s.forms.map((f) => {
        if (f.id !== activeFormId) return f;
        return {
          ...f,
          fields: f.fields.map((x) =>
            x.id === fieldId ? { ...x, expanded: !x.expanded } : x,
          ),
        };
      }),
    }));
  },

  importFromSchema: (schemaJson) => {
    try {
      const schema = JSON.parse(schemaJson);
      if (!schema.properties)
        throw new Error('No "properties" key found in schema');

      const fields: FormField[] = Object.entries(schema.properties).map(
        ([key, val]: [string, any], i) => ({
          id: `field-${Date.now()}-${i}`,
          type: val.enum
            ? "select"
            : val.format === "date"
            ? "date"
            : val.type === "boolean"
            ? "boolean"
            : val.type === "number"
            ? "number"
            : val.type === "array"
            ? "multiselect"
            : "string",
          label: val.title || key,
          key,
          required: (schema.required ?? []).includes(key),
          placeholder: val.description ?? "",
          description: val.description ?? "",
          options: val.enum ? val.enum.join(",") : undefined,
          expanded: false,
        }),
      );

      const newForm: FormDefinition = {
        id: `form-${Date.now()}`,
        name: schema.title || "Imported Form",
        description: schema.description,
        fields,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      set((s) => ({ forms: [...s.forms, newForm], activeFormId: newForm.id }));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
}));
