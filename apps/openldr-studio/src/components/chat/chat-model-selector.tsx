"use client";

import { useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useModelStore } from "@/store/model-store";
import { ModelDownloadProgress } from "@/components/chat/chat-model-download-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DownloadIcon, ServerIcon, RefreshCwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelLoadingIndicator } from "./chat-model-loading-indicator";

const SUGGESTED_MODELS = [
  {
    id: "Qwen/Qwen2.5-0.5B-Instruct",
    label: "Qwen 2.5 0.5B",
    description: "",
    tag: null,
  },
  {
    id: "Qwen/Qwen2.5-1.5B-Instruct",
    label: "Qwen 2.5 1.5B",
    description: "",
    tag: null,
  },
  {
    id: "Qwen/Qwen2.5-3B-Instruct",
    label: "Qwen 2.5 3B",
    description: "",
    tag: null,
  },
  {
    id: "microsoft/Phi-3.5-mini-instruct",
    label: "Phi 3.5 Mini",
    description: "",
    tag: null,
  },
  {
    id: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    label: "SmolLM2 1.7B",
    description: "",
    tag: null,
  },
];

interface ModelSelectorProps {
  className?: string;
}

export function ModelSelector({ className }: ModelSelectorProps) {
  const [customModelId, setCustomModelId] = useState("");

  // Stable scalar/primitive selectors - safe without useShallow
  const loadedModelId = useModelStore((s) => s.loadedModelId);

  // Array selector - must use useShallow to stabilize reference
  const availableModels = useModelStore(useShallow((s) => s.availableModels));

  // Actions are stable references (Zustand guarantees this) - no useShallow needed
  const startDownload = useModelStore((s) => s.startDownload);
  const fetchAvailableModels = useModelStore((s) => s.fetchAvailableModels);

  // Fetch on mount using getState() - avoids re-render loop
  useEffect(() => {
    useModelStore.getState().fetchAvailableModels();
    useModelStore.getState().syncLoadedModel();
  }, []);

  const handleCustomDownload = () => {
    const id = customModelId.trim();
    if (!id) return;
    startDownload(id);
    setCustomModelId("");
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between  px-2">
        <div className="flex items-center gap-2 justify-between w-full">
          <span className="text-sm font-medium"> Models</span>
          {loadedModelId && (
            <Badge
              variant="outline"
              className="text-xs border-green-500/40 text-green-600"
            >
              {loadedModelId.split("/").pop()} active
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={fetchAvailableModels}
          title="Refresh model list"
        >
          <RefreshCwIcon className="size-3.5" />
        </Button>
      </div>

      <ModelLoadingIndicator />

      <Separator />

      {/* Suggested models */}
      <div className="space-y-3  px-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Suggested
        </p>
        {SUGGESTED_MODELS.map((m) => (
          <div key={m.id} className="space-y-1">
            {/* <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{m.label}</span>
              {m.tag && (
                <Badge variant="secondary" className="text-xs">
                  {m.tag}
                </Badge>
              )}
            </div> */}
            <p className="text-xs text-muted-foreground">{m.description}</p>
            <ModelDownloadProgress modelId={m.id} />
          </div>
        ))}
      </div>

      <Separator />

      {/* Already downloaded */}
      {availableModels.length > 0 && (
        <>
          <div className="space-y-2  px-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Downloaded
            </p>
            {availableModels.map((m) => (
              <ModelDownloadProgress
                key={m.model_id}
                modelId={m.model_id}
                showLoadButton
              />
            ))}
          </div>
          <Separator />
        </>
      )}

      {/* Custom model input */}
      <div className="space-y-2  px-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Custom HuggingFace model
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="org/model-name"
            value={customModelId}
            onChange={(e) => setCustomModelId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustomDownload()}
            className="h-8 text-sm rounded-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleCustomDownload}
            disabled={!customModelId.trim()}
            className="gap-1.5 shrink-0 rounded-xs"
          >
            <DownloadIcon className="size-3.5" />
            Get
          </Button>
        </div>
      </div>
    </div>
  );
}
