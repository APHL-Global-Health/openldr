import React, { useState } from "react";
import type { FormDefinition } from "@/types/forms";
import { formatSchemaJson } from "@/lib/schema";
import { useFormBuilderStore } from "@/store/formBuilderStore";
import { Button } from "./ui";

interface SchemaViewProps {
  form: FormDefinition | null;
}

function highlight(json: string): React.ReactNode {
  const lines = json.split("\n");
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = [];
    let rest = line;

    // Key
    const keyMatch = rest.match(/^(\s*)("[\w$@]+")(\s*:\s*)(.*)/);
    if (keyMatch) {
      parts.push(<span key="ws">{keyMatch[1]}</span>);
      parts.push(
        <span key="key" className="text-[#93C5FD]">
          {keyMatch[2]}
        </span>,
      );
      parts.push(
        <span key="colon" className="text-[#607A94]">
          {keyMatch[3]}
        </span>,
      );
      rest = keyMatch[4];
    }

    // Value coloring
    if (/^"/.test(rest.trim())) {
      parts.push(
        <span key="val" className="text-[#6EE7B7]">
          {rest}
        </span>,
      );
    } else if (/^(true|false|null)/.test(rest.trim())) {
      parts.push(
        <span key="val" className="text-[#FCA5A5]">
          {rest}
        </span>,
      );
    } else if (/^[\d.-]/.test(rest.trim())) {
      parts.push(
        <span key="val" className="text-[#FCD34D]">
          {rest}
        </span>,
      );
    } else {
      parts.push(
        <span key="val" className="text-[#A0B4C8]">
          {rest}
        </span>,
      );
    }

    return (
      <div key={i} className="leading-relaxed">
        {parts.length > 1 ? (
          parts
        ) : (
          <span className="text-[#A0B4C8]">{line}</span>
        )}
      </div>
    );
  });
}

export const SchemaView: React.FC<SchemaViewProps> = ({ form }) => {
  const { importFromSchema } = useFormBuilderStore();
  const [copied, setCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  const schemaJson = form ? formatSchemaJson(form) : "";

  const handleCopy = async () => {
    if (!schemaJson) return;
    await navigator.clipboard.writeText(schemaJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    const result = importFromSchema(importText);
    if (result.ok) {
      setShowImport(false);
      setImportText("");
      setImportError("");
    } else {
      setImportError(result.error ?? "Unknown error");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#1E2E42]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#607A94]">
            JSON Schema
          </span>
          {form && (
            <span className="text-[10px] text-[#4A6480] ">draft-07</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowImport((v) => !v)}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import
          </Button>
          {form && (
            <Button
              size="sm"
              variant={copied ? "primary" : "secondary"}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="flex-shrink-0 p-4 border-b border-[#1E2E42] bg-[#0F1828] space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6EE7B7]">
            Import JSON Schema
          </p>
          <textarea
            className="w-full bg-[#0A1628] border border-[#2A3F57] text-[#A8C7E8] rounded-lg p-3 text-[11px]  focus:border-[#6EE7B7] outline-none resize-y min-h-[120px] placeholder:text-[#2A3F57]"
            placeholder={
              '{\n  "$schema": "http://json-schema.org/draft-07/schema#",\n  "title": "My Form",\n  "properties": { ... }\n}'
            }
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          {importError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {importError}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleImport}
              disabled={!importText.trim()}
            >
              Import & Create Form
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowImport(false);
                setImportError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Schema output */}
      <div className="flex-1 overflow-y-auto p-4">
        {!form ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-[#3A5068]">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p className="text-sm">No form selected</p>
          </div>
        ) : (
          <div
            className="rounded-xl border border-[#1E2E42] bg-[#0A1628] p-4  text-[12px] leading-relaxed overflow-x-auto"
            style={{ tabSize: 2 }}
          >
            {highlight(schemaJson)}
          </div>
        )}
      </div>
    </div>
  );
};
