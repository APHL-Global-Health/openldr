import { useLiveRun } from "@/contexts/LiveRunContext";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function FooterRunIndicator() {
  const { activeRun, openSheet } = useLiveRun();
  const navigate = useNavigate();

  if (!activeRun) return null;

  const { polling, done, failed } = activeRun;

  const dotClass = done
    ? failed
      ? "bg-[#f87171]"
      : "bg-[#34d399]"
    : failed
      ? "bg-[#f87171] animate-pulse-dot"
      : "bg-[#f59e0b] animate-pulse-dot";

  const label = done
    ? failed
      ? "Run failed"
      : "Run completed"
    : failed
      ? "Running (errors)"
      : "1 run active";

  const baseUrl = import.meta.env.VITE_BASE_URL || "/";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={openSheet}
        className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
        <span className="text-[10px] hidden md:block">{label}</span>
      </button>
      <button
        type="button"
        onClick={() => navigate(`${baseUrl}pipeline-runs`)}
        className="text-[9px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors hidden md:block"
      >
        View All
      </button>
    </div>
  );
}
