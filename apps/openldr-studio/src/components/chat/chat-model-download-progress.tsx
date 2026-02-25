"use client";

import { useModelStore } from "@/store/model-store";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DownloadIcon,
  CheckCircle2Icon,
  XCircleIcon,
  LoaderIcon,
  ChevronRightIcon,
  CircleArrowDownIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DownloadStatus } from "@/lib/restClients/aiRestClient";

interface ModelDownloadProgressProps {
  modelId: string;
  showLoadButton?: boolean;
  className?: string;
}

export function ModelDownloadProgress({
  modelId,
  showLoadButton = true,
  className,
}: ModelDownloadProgressProps) {
  // Select only the specific download entry for this modelId
  // This is a derived object - use individual primitives to avoid reference churn
  const status = useModelStore(
    (s) => (s.downloads[modelId]?.status ?? "idle") as DownloadStatus,
  );
  const progress = useModelStore((s) => s.downloads[modelId]?.progress ?? 0);
  const downloadedGb = useModelStore(
    (s) => s.downloads[modelId]?.downloadedGb ?? 0,
  );
  const totalGb = useModelStore((s) => s.downloads[modelId]?.totalGb ?? 0);
  const error = useModelStore((s) => s.downloads[modelId]?.error ?? null);

  // Scalars - safe without useShallow
  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const isLoadingModel = useModelStore((s) => s.isLoadingModel);

  // Actions - stable Zustand references
  const startDownload = useModelStore((s) => s.startDownload);
  const loadModel = useModelStore((s) => s.loadModel);
  const clearDownloadError = useModelStore((s) => s.clearDownloadError);

  const isLoaded = loadedModelId === modelId;
  const shortName = modelId.split("/").pop() ?? modelId;

  if (status === "idle") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 border-border py-4 border-t",
          className,
        )}
      >
        <CircleArrowDownIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm truncate flex-1">{shortName}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => startDownload(modelId)}
          className="gap-1.5 shrink-0 rounded-xs"
        >
          {/* <DownloadIcon className="size-3.5" /> */}
          Download
        </Button>
      </div>
    );
  }

  if (status === "downloading") {
    return (
      <div className={cn("space-y-2  border-border py-4 border-t", className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <LoaderIcon className="size-3.5 shrink-0 animate-spin text-primary" />
            <span className="text-sm font-medium truncate">{shortName}</span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {progress.toFixed(0)}%
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
        {totalGb > 0 && (
          <p className="text-xs text-muted-foreground">
            {downloadedGb.toFixed(2)} GB / {totalGb.toFixed(2)} GB
          </p>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={cn("space-y-2 border-border py-4 border-t", className)}>
        <div className="flex items-center gap-2">
          <XCircleIcon className="size-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium truncate">{shortName}</span>
          <Badge variant="destructive" className="ml-auto shrink-0 text-xs">
            Failed
          </Badge>
        </div>
        {error && (
          <p className="text-xs text-destructive/80 line-clamp-2">{error}</p>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            clearDownloadError(modelId);
            startDownload(modelId);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  // status === "ready"
  return (
    <div className={cn("space-y-2 border-border py-4 border-t", className)}>
      <div className="flex items-center gap-2">
        <CheckCircle2Icon className="size-4 shrink-0 text-green-500" />
        <span className="text-sm font-medium truncate flex-1">{shortName}</span>
        {isLoaded ? (
          <Badge
            variant="outline"
            className="shrink-0 rounded-xs text-xs border-green-500/50 text-green-600"
          >
            Loaded
          </Badge>
        ) : (
          showLoadButton && (
            <Button
              size="sm"
              variant="outline"
              disabled={isLoadingModel}
              onClick={() => loadModel(modelId)}
              className="gap-1.5 shrink-0 rounded-xs"
            >
              {/* {isLoadingModel ? (
                <LoaderIcon className="size-3.5 animate-spin" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              )} */}
              Load
            </Button>
          )
        )}
      </div>
    </div>
  );
}
