import type { CheckResult } from "@/types/plugin-test.types";
import { JsonTree } from "./JsonTree";

// ── Stage Output Panel ────────────────────────────────────────────────────────
interface StageOutputProps {
  label: string;
  headerClass: string; // active border class
  dotActiveClass: string;
  data: Record<string, unknown> | null;
  checks: CheckResult[] | null;
  running: boolean;
  done: boolean;
  durationMs?: number;
}

export function StageOutput({
  label,
  headerClass,
  dotActiveClass,
  data,
  checks,
  running,
  done,
  durationMs,
}: StageOutputProps) {
  const passCount = checks?.filter((c) => c.status === "pass").length ?? 0;
  const warnCount = checks?.filter((c) => c.status === "warn").length ?? 0;
  const failCount = checks?.filter((c) => c.status === "fail").length ?? 0;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-[#080d14] transition-colors duration-300 ${
        done ? headerClass : "border-slate-800"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b px-4 py-2.5 transition-colors duration-300 ${
          done
            ? `${headerClass.replace("border-", "border-b-")} bg-white/[0.02]`
            : "border-slate-800/50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-sm transition-colors duration-300 ${
              done ? dotActiveClass : "bg-slate-800"
            }`}
          />
          <span
            className={`font-mono text-[10px] uppercase tracking-[2px] transition-colors duration-300 ${
              done ? "text-slate-300" : "text-slate-700"
            }`}
          >
            {label} Output
          </span>
          {durationMs !== undefined && done && (
            <span className="font-mono text-[9px] text-slate-600">
              {durationMs}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {running && (
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-1 w-1 rounded-full ${dotActiveClass} animate-pulse`}
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          )}
          {done && checks && (
            <div className="flex gap-2 font-mono text-[10px]">
              {passCount > 0 && (
                <span className="text-green-400">✓ {passCount}</span>
              )}
              {warnCount > 0 && (
                <span className="text-amber-400">⚠ {warnCount}</span>
              )}
              {failCount > 0 && (
                <span className="text-red-400">✗ {failCount}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Check rows */}
      {done && checks && checks.length > 0 && (
        <div className="border-b border-slate-800/50">
          {checks.map((c, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 px-4 py-1.5 ${
                i < checks.length - 1 ? "border-b border-slate-800/30" : ""
              }`}
            >
              <span
                className={`mt-px font-mono text-[11px] ${
                  c.status === "pass"
                    ? "text-green-400"
                    : c.status === "warn"
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {c.status === "pass" ? "✓" : c.status === "warn" ? "⚠" : "✗"}
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {c.rule}
              </span>
              <span className="ml-auto font-mono text-[10px] text-slate-600">
                {c.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* JSON output */}
      <div className="min-h-[60px] p-4 font-mono text-[11px] leading-relaxed text-slate-400">
        {!done && !running && (
          <span className="text-slate-700">— awaiting run —</span>
        )}
        {running && <span className="italic text-slate-600">Processing…</span>}
        {done && data && <JsonTree data={data} />}
      </div>
    </div>
  );
}
