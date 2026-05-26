import { type ColumnDef } from "@tanstack/react-table";
import type { PipelineRun } from "@/lib/restClients/pipelineRunsRestClient";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

// ── Helpers ─────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = ["ingest", "validation", "mapping", "storage", "outpost"];

const STAGE_ORDER: Record<string, number> = Object.fromEntries(
  PIPELINE_STAGES.map((s, i) => [s, i]),
);

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-400",
  failed: "bg-red-400",
  processing: "bg-amber-400 animate-pulse",
  queued: "bg-zinc-400",
  deleted: "bg-zinc-600",
};

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDuration(start: string, end: string | null): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  if (ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Mini stage dots ─────────────────────────────────────────────────────────

function StageDots({ currentStage, currentStatus }: { currentStage: string; currentStatus: string }) {
  const currentIdx = STAGE_ORDER[currentStage] ?? -1;

  return (
    <div className="flex items-center gap-0.5">
      {PIPELINE_STAGES.map((stage, i) => {
        let color = "bg-zinc-700"; // pending
        if (i < currentIdx) color = "bg-green-400";
        else if (i === currentIdx) {
          if (currentStatus === "completed") color = "bg-green-400";
          else if (currentStatus === "failed") color = "bg-red-400";
          else color = "bg-amber-400 animate-pulse";
        }
        return (
          <Tooltip key={stage}>
            <TooltipTrigger asChild>
              <span className={`h-2 w-2 rounded-full ${color}`} />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {stage}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── Column definitions ──────────────────────────────────────────────────────

export function getColumns(
  onRowClick: (messageId: string) => void,
): ColumnDef<PipelineRun>[] {
  return [
    {
      accessorKey: "currentStatus",
      header: "",
      size: 32,
      cell: ({ row }) => {
        const status = row.original.currentStatus;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status] ?? "bg-zinc-400"}`} />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs capitalize">
              {status}
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "messageId",
      header: "Run ID",
      size: 100,
      cell: ({ row }) => {
        const id = row.original.messageId;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="font-mono text-xs text-blue-400 hover:underline cursor-pointer"
                onClick={() => onRowClick(id)}
              >
                {id.slice(0, 8)}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-mono">
              {id}
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "projectName",
      header: "Project",
      size: 140,
      cell: ({ row }) => (
        <span className="text-xs truncate max-w-[140px] block">
          {row.original.projectName ?? row.original.projectId?.slice(0, 8)}
        </span>
      ),
    },
    {
      accessorKey: "dataFeedName",
      header: "Feed",
      size: 140,
      cell: ({ row }) => (
        <span className="text-xs truncate max-w-[140px] block">
          {row.original.dataFeedName ?? row.original.dataFeedId?.slice(0, 8) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "userId",
      header: "User",
      size: 100,
      cell: ({ row }) => (
        <span className="text-xs font-mono truncate max-w-[100px] block text-muted-foreground">
          {row.original.userId?.slice(0, 8) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "contentType",
      header: "Type",
      size: 120,
      cell: ({ row }) => {
        const ct = row.original.contentType;
        if (!ct) return <span className="text-muted-foreground text-xs">—</span>;
        const short = ct.replace("application/", "").replace("text/", "");
        return <Badge variant="outline" className="text-[10px] font-mono">{short}</Badge>;
      },
    },
    {
      accessorKey: "fileSize",
      header: "Size",
      size: 70,
      cell: ({ row }) => (
        <span className="text-xs font-mono text-muted-foreground">
          {formatBytes(row.original.fileSize)}
        </span>
      ),
    },
    {
      id: "stage",
      header: "Stage",
      size: 90,
      cell: ({ row }) => (
        <StageDots
          currentStage={row.original.currentStage}
          currentStatus={row.original.currentStatus}
        />
      ),
    },
    {
      id: "errors",
      header: "Errors",
      size: 60,
      cell: ({ row }) => {
        if (!row.original.errorCode) return null;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="text-[10px]">1</Badge>
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-80">
              {row.original.errorCode}: {row.original.errorMessage}
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Started",
      size: 80,
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground">
              {timeAgo(row.original.createdAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {new Date(row.original.createdAt).toLocaleString()}
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      id: "duration",
      header: "Duration",
      size: 80,
      cell: ({ row }) => (
        <span className="text-xs font-mono text-muted-foreground">
          {formatDuration(row.original.createdAt, row.original.completedAt)}
        </span>
      ),
    },
  ];
}
