import type { CheckResult } from "@/types/plugin-test.types";
import { JsonTree } from "./JsonTree";

import CodeMirror from "@uiw/react-codemirror";
import { EditorState } from "@codemirror/state";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { getCurrentTheme } from "@/lib/theme";
import { useEffect, useState } from "react";

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

  const [theme, setTheme] = useState(getCurrentTheme);

  useEffect(() => {
    const onThemeChange = () => {
      setTheme(getCurrentTheme());
    };
    window.addEventListener("themechange", onThemeChange);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onThemeChange);

    return () => {
      window.removeEventListener("themechange", onThemeChange);
      mq.removeEventListener("change", onThemeChange);
    };
  }, []);

  return (
    <div
      className={`flex flex-col overflow-hidden w-full h-full rounded-sm border bg-card transition-colors duration-300 ${
        done ? headerClass : "border-slate-800"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b px-4 py-2.5 transition-colors duration-300 ${
          done
            ? `${headerClass.replace("border-", "border-b-")} bg-white/2`
            : "border-slate-800/50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-sm transition-colors duration-300 ${
              done ? dotActiveClass : "bg-border"
            }`}
          />
          <span
            className={` text-[10px] uppercase tracking-[2px] transition-colors duration-300 ${
              done ? "" : ""
            }`}
          >
            {label} Output
          </span>
          {durationMs !== undefined && done && (
            <span className=" text-[9px] ">{durationMs}ms</span>
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
            <div className="flex gap-2  text-[10px]">
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
                className={`mt-px  text-[11px] ${
                  c.status === "pass"
                    ? "text-green-400"
                    : c.status === "warn"
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {/* {c.status === "pass" ? "✓" : c.status === "warn" ? "⚠" : "✗"} */}
              </span>
              <span className=" text-[10px] ">{c.rule}</span>
              <span className="ml-auto  text-[10px] ">{c.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* JSON output */}
      <div className="flex flex-col flex-1 min-h-0 text-[11px] leading-relaxed">
        {!done && !running && (
          <span className="text-muted-foreground p-4">— awaiting run —</span>
        )}
        {running && <span className="italic p-4">Processing…</span>}
        {
          done && data && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <CodeMirror
                value={JSON.stringify(data, null, 2)}
                className="w-full h-full"
                height="100%"
                theme={theme === "dark" ? vscodeDark : vscodeLight}
                extensions={[
                  EditorState.readOnly.of(true),
                  EditorView.editable.of(false),
                  json(),
                  EditorView.lineWrapping,
                ]}
              />
            </div>
          )
          // <JsonTree data={data} />
        }
      </div>
    </div>
  );
}
