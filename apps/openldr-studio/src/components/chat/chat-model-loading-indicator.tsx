"use client";

import { useEffect, useState } from "react";
import { useModelStore } from "@/store/model-store";
import { Progress } from "@/components/ui/progress";
import { BrainIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shown inside the model Sheet while a model is loading into memory.
 * Simulates progress since HuggingFace load time is opaque.
 * Drop this at the top of ModelSelector, above the Separator.
 */
export function ModelLoadingIndicator() {
  const isLoadingModel = useModelStore((s) => s.isLoadingModel);
  const loadError = useModelStore((s) => s.loadError);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoadingModel) {
      setProgress(0);
      return;
    }

    // Simulate progress: fast to 40%, then slow crawl to 90%, never reaches 100%
    // until the store sets isLoadingModel = false
    setProgress(5);
    const intervals: ReturnType<typeof setInterval>[] = [];

    // Fast phase: 0-40% over 4s
    const fast = setInterval(() => {
      setProgress((p) => {
        if (p >= 40) { clearInterval(fast); return p; }
        return p + 3;
      });
    }, 300);
    intervals.push(fast);

    // Slow phase: 40-90% over ~50s
    const slow = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(slow); return p; }
        return p + 0.8;
      });
    }, 600);
    intervals.push(slow);

    return () => intervals.forEach(clearInterval);
  }, [isLoadingModel]);

  if (!isLoadingModel && !loadError) return null;

  return (
    <div
      className={cn(
        "rounded-md border p-3 space-y-2",
        loadError
          ? "border-destructive/50 bg-destructive/5"
          : "border-primary/20 bg-primary/5"
      )}
    >
      {loadError ? (
        <p className="text-xs text-destructive">{loadError}</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <BrainIcon className="size-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium text-primary">
              Loading model into memory...
            </span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {progress.toFixed(0)}%
            </span>
          </div>
          <Progress value={progress} className="h-1" />
          <p className="text-xs text-muted-foreground">
            This takes 30–60 seconds on CPU. The UI will unlock when ready.
          </p>
        </>
      )}
    </div>
  );
}
