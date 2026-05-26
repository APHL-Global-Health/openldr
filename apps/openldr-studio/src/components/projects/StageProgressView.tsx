import type { LiveEvent } from "@/lib/restClients/dataProcessingRestClient";

// ── Stage config ─────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  "ingest",
  "validation",
  "mapping",
  "storage",
  "outpost",
] as const;

const STAGE_COLORS: Record<string, { dot: string; label: string }> = {
  ingest: { dot: "bg-blue-400", label: "text-blue-400" },
  validation: { dot: "bg-sky-400", label: "text-sky-400" },
  mapping: { dot: "bg-violet-400", label: "text-violet-400" },
  storage: { dot: "bg-emerald-400", label: "text-emerald-400" },
  outpost: { dot: "bg-orange-400", label: "text-orange-400" },
};

function stageColors(stage: string) {
  return (
    STAGE_COLORS[stage] ?? {
      dot: "bg-muted-foreground",
      label: "text-muted-foreground",
    }
  );
}

function statusIcon(status: string) {
  if (status === "failed")
    return <span className="text-red-400">&#10007;</span>;
  if (status === "completed")
    return <span className="text-green-400">&#10003;</span>;
  if (status === "processing")
    return <span className="text-amber-400 inline-block">&#8635;</span>;
  return <span className="text-muted-foreground">&middot;</span>;
}

function statusLabel(status: string, stage: string) {
  if (status === "completed") {
    const labels: Record<string, string> = {
      ingest: "accepted",
      validation: "passed",
      mapping: "mapped",
      storage: "stored",
      outpost: "exported",
    };
    return labels[stage] ?? "completed";
  }
  if (status === "failed") return "failed";
  if (status === "processing") return "processing";
  return "";
}

// ── Component ────────────────────────────────────────────────────────────────

interface StageProgressViewProps {
  events: LiveEvent[];
  messageId: string | null;
  polling: boolean;
  done: boolean;
  failed: boolean;
  stalenessSeconds: number;
}

export function StageProgressView({
  events,
  messageId,
  polling,
  done,
  failed,
  stalenessSeconds,
}: StageProgressViewProps) {
  if (!messageId) {
    return (
      <div className="flex flex-col w-full h-full">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-border" />
            <span className="text-[10px] uppercase tracking-[2px]">
              Live Output
            </span>
          </div>
        </div>
        <span className="text-muted-foreground p-4 text-[11px]">
          — awaiting live run —
        </span>
      </div>
    );
  }

  // Group events by stage
  const byStage = new Map<string, LiveEvent[]>();
  for (const ev of events) {
    const list = byStage.get(ev.stage) ?? [];
    list.push(ev);
    byStage.set(ev.stage, list);
  }

  const borderColor = done
    ? failed
      ? "border-red-500/30"
      : "border-green-500/30"
    : "border-border";

  return (
    <div className="flex flex-col w-full h-full bg-card">
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b px-4 py-2.5 ${borderColor}`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-sm ${
              done
                ? failed
                  ? "bg-red-400"
                  : "bg-green-400"
                : failed
                ? "bg-red-400 animate-pulse"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-[10px] uppercase tracking-[2px]">
            Live Output
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">
            {messageId.slice(0, 8)}&hellip;
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {polling && (
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1 w-1 rounded-full bg-amber-400 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          )}
          {done && (
            <span className={failed ? "text-red-400" : "text-green-400"}>
              {failed ? "Failed" : "Completed"}
            </span>
          )}
        </div>
      </div>

      {/* Stage rows */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {events.length === 0 && !done ? (
          <span className="text-muted-foreground p-4 text-[11px] italic block">
            Waiting for pipeline events&hellip;
          </span>
        ) : (
          <div className="flex flex-col">
            {PIPELINE_STAGES.map((stage) => {
              const stageEvents = byStage.get(stage);
              const sc = stageColors(stage);

              if (!stageEvents || stageEvents.length === 0) {
                // Pending stage
                return (
                  <StageRow
                    key={stage}
                    stage={stage}
                    sc={sc}
                    icon={
                      <span className="text-muted-foreground">&mdash;</span>
                    }
                    label=""
                    count={null}
                    timestamp={null}
                    plugin={null}
                    dimmed
                  />
                );
              }

              // Render one row per status (completed, failed, processing)
              return stageEvents.map((ev, i) => (
                <StageRow
                  key={`${stage}-${ev.status}-${i}`}
                  stage={i === 0 ? stage : ""}
                  sc={sc}
                  icon={statusIcon(ev.status)}
                  label={statusLabel(ev.status, stage)}
                  count={ev.count}
                  timestamp={ev.lastAt}
                  plugin={
                    ev.pluginName
                      ? `${ev.pluginName}${
                          ev.pluginVersion ? ` v${ev.pluginVersion}` : ""
                        }`
                      : null
                  }
                  dimmed={false}
                />
              ));
            })}
          </div>
        )}

        {/* Staleness warning */}
        {polling && stalenessSeconds > 15 && (
          <div
            className={`px-4 py-2 text-[10px] border-t ${
              stalenessSeconds > 30
                ? "text-amber-400 bg-amber-400/5"
                : "text-muted-foreground"
            }`}
          >
            {stalenessSeconds > 30
              ? `Pipeline may be stalled — no events for ${stalenessSeconds}s`
              : `Last event ${stalenessSeconds}s ago`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stage row ────────────────────────────────────────────────────────────────

function StageRow({
  stage,
  sc,
  icon,
  label,
  count,
  timestamp,
  plugin,
  dimmed,
}: {
  stage: string;
  sc: { dot: string; label: string };
  icon: React.ReactNode;
  label: string;
  count: number | null;
  timestamp: string | null;
  plugin: string | null;
  dimmed: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 border-b border-border/40 ${
        dimmed ? "opacity-40" : ""
      }`}
    >
      {/* Stage dot */}
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          stage ? sc.dot : "bg-transparent"
        }`}
      />

      {/* Stage label */}
      <span
        className={`text-[9px] uppercase tracking-[1.5px] w-16 shrink-0 ${
          stage ? sc.label : ""
        }`}
      >
        {stage}
      </span>

      {/* Status icon + label */}
      <span className="text-[10px] flex items-center gap-1 min-w-20">
        {icon}
        {label && <span>{label}</span>}
      </span>

      {/* Record count */}
      {count != null && count > 0 && (
        <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
          ({count.toLocaleString()})
        </span>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Plugin name */}
      {plugin && (
        <span className="text-[9px] text-muted-foreground font-mono">
          {plugin}
        </span>
      )}

      {/* Timestamp */}
      {timestamp && (
        <span className="text-[9px] text-muted-foreground shrink-0">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
