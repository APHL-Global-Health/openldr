import { useExtensions } from "@/hooks/misc/useExtensions";
import { Activity, AlertTriangle, Check, X } from "lucide-react";
import { types } from "@openldr/extensions";
import { cn } from "@/lib/utils";

export const NOTIF_CONFIG: Record<
  types.NotificationKind,
  { cls: string; icon: React.ReactNode }
> = {
  info: {
    cls: "bg-sky-950/90 border-sky-900/60 text-sky-200",
    icon: <Activity className="h-3.5 w-3.5 text-sky-400 shrink-0" />,
  },
  success: {
    cls: "bg-emerald-950/90 border-emerald-900/60 text-emerald-200",
    icon: <Check className="h-3.5 w-3.5 text-[#34d399] shrink-0" />,
  },
  warning: {
    cls: "bg-amber-950/90 border-amber-900/60 text-amber-200",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-[#f59e0b] shrink-0" />,
  },
  error: {
    cls: "bg-red-950/90 border-red-900/60 text-red-200",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-[#f87171] shrink-0" />,
  },
};

export function NotificationStack() {
  const { state, dispatch } = useExtensions();
  return (
    <div className="fixed top-3 right-3 z-9996 flex flex-col gap-2 w-[320px] pointer-events-none">
      {state.notifications.map((n) => {
        const cfg = NOTIF_CONFIG[n.kind] || NOTIF_CONFIG.info;
        return (
          <div
            key={n.id}
            className={cn(
              "flex items-start gap-2.5 px-3 py-2.5 rounded-lg border backdrop-blur-sm shadow-xl pointer-events-auto",
              "animate-in slide-in-from-right-4 fade-in-0 duration-200",
              cfg.cls,
            )}
          >
            {cfg.icon}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] leading-snug wrap-break-word font-sans">
                {n.message}
              </p>
              <p className="text-[10px] opacity-40 mt-0.5 font-mono">
                {n.extId} · {n.ts}
              </p>
            </div>
            <button
              onClick={() =>
                dispatch({ type: "DISMISS_NOTIFICATION", payload: n.id })
              }
              className="opacity-40 hover:opacity-80 transition-opacity shrink-0 mt-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
