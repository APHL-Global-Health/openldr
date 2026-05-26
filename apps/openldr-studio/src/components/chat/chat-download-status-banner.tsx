"use client";

import { useShallow } from "zustand/react/shallow";
import { useModelStore, selectActiveDownloads } from "@/store/model-store";
import { Progress } from "@/components/ui/progress";
import { DownloadIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating status bar shown at the bottom of the screen whenever a model
 * is downloading. Visible on ALL pages, not just the chat page.
 * Mount once in your root layout: <DownloadStatusBanner />
 */
export function DownloadStatusBanner() {
  // useShallow prevents re-render when unrelated store slices change
  const activeDownloads = useModelStore(
    useShallow((s) =>
      Object.values(s.downloads).filter((d) => d.status === "downloading"),
    ),
  );

  if (activeDownloads.length === 0) return null;

  const current = activeDownloads[activeDownloads.length - 1];
  const shortName = current.modelId.split("/").pop() ?? current.modelId;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50",
        "w-72 rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg p-3",
        "animate-in slide-in-from-bottom-4 duration-300",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <DownloadIcon className="size-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium truncate flex-1">{shortName}</span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {current.progress.toFixed(0)}%
        </span>
      </div>
      <Progress value={current.progress} className="h-1" />
      {current.totalGb > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {current.downloadedGb.toFixed(2)} / {current.totalGb.toFixed(2)} GB
          {activeDownloads.length > 1 && (
            <span className="ml-1 text-primary">
              +{activeDownloads.length - 1} more
            </span>
          )}
        </p>
      )}
    </div>
  );
}
