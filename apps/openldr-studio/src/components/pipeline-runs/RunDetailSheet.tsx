import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, RotateCcw, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { StageProgressView } from "@/components/projects/StageProgressView";
import {
  usePipelineRunDetail,
  useRetryRun,
  useDeleteRun,
} from "@/hooks/misc/usePipelineRuns";

interface RunDetailSheetProps {
  messageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDuration(start: string, end: string | null): string {
  const ms =
    (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  if (ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function CopyButton({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground p-0.5"
          onClick={() => {
            navigator.clipboard.writeText(text);
            toast.info("Copied");
          }}
        >
          <Copy className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">Copy</TooltipContent>
    </Tooltip>
  );
}

export function RunDetailSheet({
  messageId,
  open,
  onOpenChange,
  onDeleted,
}: RunDetailSheetProps) {
  const { data, isLoading, dataUpdatedAt } = usePipelineRunDetail(
    open ? messageId : null,
  );
  const retryMutation = useRetryRun();
  const deleteMutation = useDeleteRun();
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stalenessSeconds, setStalenessSeconds] = useState(0);
  const lastDataRef = useRef<string>("");

  const run = data?.run;
  const events = data?.events ?? [];
  const fileHash = data?.fileHash;

  const isFailed = run?.currentStatus === "failed";
  const isDeleted = run?.currentStatus === "deleted";
  const isActive =
    run?.currentStatus === "processing" || run?.currentStatus === "queued";

  // Staleness tracking — detect when events stop changing
  useEffect(() => {
    if (!isActive) {
      setStalenessSeconds(0);
      return;
    }

    const snapshot = JSON.stringify(
      events.map((e) => `${e.stage}:${e.status}:${e.count}`),
    );
    if (snapshot !== lastDataRef.current) {
      lastDataRef.current = snapshot;
      setStalenessSeconds(0);
    }

    const id = setInterval(() => setStalenessSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isActive, dataUpdatedAt, events]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-120 sm:w-135 p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-sm">Run Detail</SheetTitle>
            {run && (
              <Badge
                variant={
                  isDeleted
                    ? "outline"
                    : isFailed
                    ? "destructive"
                    : isActive
                    ? "outline"
                    : "secondary"
                }
                className={`text-[10px] ${
                  isDeleted ? "border-red-500/50 text-red-400" : ""
                }`}
              >
                {run.currentStatus}
              </Badge>
            )}
          </div>
          <SheetDescription className="text-xs font-mono flex items-center gap-1">
            {messageId}
            {messageId && <CopyButton text={messageId} />}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          {isLoading && (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          )}

          {run && (
            <div className="flex flex-col">
              {/* Stage Progress */}
              <div className="border-b">
                <StageProgressView
                  events={events}
                  messageId={messageId}
                  polling={isActive}
                  done={!isActive}
                  failed={isFailed}
                  stalenessSeconds={stalenessSeconds}
                />
              </div>

              {/* Metadata */}
              <div className="px-4 py-3 border-b">
                <h4 className="text-[10px] uppercase tracking-[2px] text-muted-foreground mb-2">
                  Metadata
                </h4>
                <div className="space-y-1">
                  {(
                    [
                      [
                        "Project",
                        run.projectName ?? run.projectId?.slice(0, 8),
                      ],
                      [
                        "Feed",
                        run.dataFeedName ?? run.dataFeedId?.slice(0, 8) ?? "—",
                      ],
                      ["User", run.userId?.slice(0, 12) ?? "—"],
                      ["Content Type", fileHash?.contentType ?? "—"],
                      ["File Size", formatBytes(fileHash?.fileSize ?? null)],
                      [
                        "Duration",
                        formatDuration(run.createdAt, run.completedAt),
                      ],
                      ...(fileHash?.hash
                        ? [["Source Hash", fileHash.hash.slice(0, 16) + "..."]]
                        : []),
                      ["Started", new Date(run.createdAt).toLocaleString()],
                      ...(run.completedAt
                        ? [
                            [
                              "Completed",
                              new Date(run.completedAt).toLocaleString(),
                            ],
                          ]
                        : []),
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 text-[10px]"
                    >
                      <span className="text-muted-foreground w-24 shrink-0">
                        {label}
                      </span>
                      <span className="text-foreground font-mono truncate flex-1">
                        {value}
                      </span>
                      {label === "Source Hash" && fileHash?.hash && (
                        <CopyButton text={fileHash.hash} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Object Paths */}
              <div className="px-4 py-3 border-b">
                <h4 className="text-[10px] uppercase tracking-[2px] text-muted-foreground mb-2">
                  Object Paths
                </h4>
                <div className="space-y-1">
                  {(
                    [
                      "rawObjectPath",
                      "validatedObjectPath",
                      "mappedObjectPath",
                      "processedObjectPath",
                    ] as const
                  ).map((field) => {
                    const path = (run as any)[field];
                    if (!path) return null;
                    const label = field.replace("ObjectPath", "");
                    return (
                      <div
                        key={field}
                        className="flex items-center gap-2 text-[10px]"
                      >
                        <span className="text-muted-foreground w-16 shrink-0">
                          {label}
                        </span>
                        <span className="font-mono truncate flex-1">
                          {path}
                        </span>
                        <CopyButton text={path} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error Details */}
              {run.errorStage && (
                <div className="px-4 py-3 border-b bg-red-500/5">
                  <button
                    className="flex items-center gap-2 w-full text-left"
                    onClick={() => setErrorExpanded(!errorExpanded)}
                  >
                    <h4 className="text-[10px] uppercase tracking-[2px] text-red-400">
                      Error Details
                    </h4>
                    {errorExpanded ? (
                      <ChevronUp className="h-3 w-3 text-red-400" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-red-400" />
                    )}
                  </button>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs mt-2">
                    <span className="text-muted-foreground">Stage</span>
                    <span className="text-red-400">{run.errorStage}</span>

                    <span className="text-muted-foreground">Code</span>
                    <span className="font-mono text-red-400">
                      {run.errorCode}
                    </span>

                    <span className="text-muted-foreground">Message</span>
                    <span className="text-red-300">{run.errorMessage}</span>
                  </div>

                  {errorExpanded && run.errorDetails && (
                    <pre className="mt-2 p-2 bg-zinc-900 rounded text-[10px] font-mono text-zinc-300 overflow-x-auto max-h-60 overflow-y-auto">
                      {JSON.stringify(run.errorDetails, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Deleted banner */}
              {isDeleted && (
                <div className="px-4 py-2 border-b bg-red-500/10 text-red-400 text-[10px] uppercase tracking-[2px]">
                  This run has been marked for deletion — pipeline will skip
                  remaining messages
                </div>
              )}

              {/* Actions */}
              <div className="px-4 py-3 flex gap-2">
                {isFailed && !isDeleted && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={retryMutation.isPending}
                    onClick={() => retryMutation.mutate(run.messageId)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {retryMutation.isPending ? "Retrying..." : "Retry"}
                  </Button>
                )}
                {isDeleted ? null : !confirmDelete ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-400">Confirm?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        deleteMutation.mutate(run.messageId, {
                          onSuccess: () => {
                            onOpenChange(false);
                            onDeleted?.();
                          },
                        });
                      }}
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Yes, delete"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
