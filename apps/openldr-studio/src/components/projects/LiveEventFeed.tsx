import type { LiveEvent } from "@/lib/restClients/dataProcessingRestClient";

// ── Stage colour config ───────────────────────────────────────────────────────
const STAGE_COLORS: Record<string, { dot: string; label: string }> = {
  ingest:     { dot: "bg-blue-400",    label: "text-blue-400" },
  validation: { dot: "bg-sky-400",     label: "text-sky-400" },
  mapping:    { dot: "bg-violet-400",  label: "text-violet-400" },
  storage:    { dot: "bg-emerald-400", label: "text-emerald-400" },
  outpost:    { dot: "bg-orange-400",  label: "text-orange-400" },
};

function stageColors(stage: string) {
  return STAGE_COLORS[stage] ?? { dot: "bg-muted-foreground", label: "text-muted-foreground" };
}

function formatEventType(eventType: string) {
  return eventType
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function statusIcon(status: string) {
  if (status === "failed")    return <span className="text-red-400">✗</span>;
  if (status === "completed") return <span className="text-green-400">✓</span>;
  if (status === "processing") return <span className="text-amber-400">↻</span>;
  return <span className="text-muted-foreground">·</span>;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface LiveEventFeedProps {
  messageId: string | null;
  events: LiveEvent[];
  polling: boolean;
  done: boolean;
  failed: boolean;
}

export function LiveEventFeed({
  messageId,
  events,
  polling,
  done,
  failed,
}: LiveEventFeedProps) {
  if (!messageId) {
    return (
      <div className="flex flex-col w-full h-full">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-border" />
            <span className="text-[10px] uppercase tracking-[2px]">Live Output</span>
          </div>
        </div>
        <span className="text-muted-foreground p-4 text-[11px]">
          — awaiting live run —
        </span>
      </div>
    );
  }

  const colors = done
    ? failed
      ? "border-red-500/30"
      : "border-green-500/30"
    : "border-border";

  return (
    <div className={`flex flex-col w-full h-full bg-card`}>
      {/* Header */}
      <div className={`flex items-center justify-between border-b px-4 py-2.5 ${colors}`}>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-sm ${
              done
                ? failed
                  ? "bg-red-400"
                  : "bg-green-400"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-[10px] uppercase tracking-[2px]">Live Output</span>
          <span className="text-[9px] text-muted-foreground font-mono">
            {messageId.slice(0, 8)}…
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

      {/* Event list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {events.length === 0 ? (
          <span className="text-muted-foreground p-4 text-[11px] italic">
            Waiting for pipeline events…
          </span>
        ) : (
          <div className="flex flex-col">
            {events.map((ev, i) => {
              const sc = stageColors(ev.stage);
              return (
                <div
                  key={`${ev.stage}-${ev.eventType}-${i}`}
                  className={`flex flex-col gap-0.5 px-4 py-2 ${
                    i < events.length - 1 ? "border-b border-border/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Stage dot */}
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sc.dot}`} />

                    {/* Stage label */}
                    <span className={`text-[9px] uppercase tracking-[1.5px] w-16 shrink-0 ${sc.label}`}>
                      {ev.stage}
                    </span>

                    {/* Status icon + event type */}
                    <span className="text-[10px] flex items-center gap-1">
                      {statusIcon(ev.status)}
                      {formatEventType(ev.eventType)}
                    </span>

                    {/* Record count (for multi-record messages) */}
                    {ev.count > 1 && (
                      <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
                        ({ev.count.toLocaleString()})
                      </span>
                    )}

                    {/* Plugin name + version */}
                    {ev.pluginName && (
                      <span className="ml-auto text-[9px] text-muted-foreground font-mono">
                        {ev.pluginName}
                        {ev.pluginVersion ? ` v${ev.pluginVersion}` : ""}
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {new Date(ev.firstAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
