import { cn } from "@/lib/utils";
import type { PipelineStageCount } from "@/types/database";

interface DataPipelineProps {
  stages: PipelineStageCount[];
}

function formatCount(n: number): string {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

const STAGE_META: Record<string, { icon: string; gradient: string }> = {
  raw: { icon: "📥", gradient: "from-slate-500 to-slate-600" },
  validated: { icon: "✅", gradient: "from-blue-500 to-blue-600" },
  mapped: { icon: "🔗", gradient: "from-violet-500 to-violet-600" },
  processed: { icon: "⚡", gradient: "from-emerald-500 to-emerald-600" },
};

export function DataPipeline({ stages }: DataPipelineProps) {
  return (
    <div>
      <div className="cursor-default border-border border bg-card rounded-sm shadow">
        <div className="flex items-center min-h-10 max-h-10 text-xs py-2 px-4 border-border border-b">
          DATA PIPELINE
        </div>
        <div className="p-2 grid grid-cols-1 sm:grid-cols-4 md:grid-cols-4 xl:grid-cols-4">
          {stages.map((stage, index) => (
            <div
              className={cn(
                "p-4 flex flex-col justify-center items-center",
                index > 0
                  ? "border-border border-t sm:border-l sm:border-t-0 md:border-l md:border-t-0 xl:border-l xl:border-t-0"
                  : "",
              )}
            >
              <p className="text-2xl font-semibold tracking-tight">
                {formatCount(stage.count)}
              </p>
              <div className="text-md text-muted-foreground flex items-center justify-center gap-2">
                <span className="flex items-center justify-center">
                  {stage.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
