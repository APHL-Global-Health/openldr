"use client";

// import { Footer } from "@/components/admin-panel/footer";
import { Sidebar } from "@/components/admin-panel/sidebar";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";
import type { AppState } from "@/types/extensions";
import { DevConsole } from "../extensions/console";

export default function AdminPanelLayout({
  state,
  apiStatus,
  children,
}: {
  state: AppState;
  apiStatus: string;
  children: React.ReactNode;
}) {
  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  const { getOpenState, settings } = sidebar;

  const sorted = [...state.statusBar].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0),
  );

  return (
    <>
      <Sidebar />
      <main
        className={cn(
          "min-h-[calc(100vh-26px)] max-h-[calc(100vh-26px)] bg-zinc-50 dark:bg-zinc-900 transition-[margin-left] ease-in-out duration-300",
          !settings.disabled && (!getOpenState() ? "lg:ml-22.5" : "lg:ml-72"),
        )}
      >
        {children}
      </main>

      <footer
        className={cn(
          "min-h-6.5 max-h-6.5 bg-background border-border border-t text-[10px] font-mono shadow-md dark:shadow-zinc-800 shrink-0 flex items-center gap-3 px-3 ease-in-out duration-300 z-21",
        )}
      >
        <span className="flex items-center gap-1.5 ">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              apiStatus === "connected"
                ? "bg-[#34d399]"
                : apiStatus === "error"
                  ? "bg-[#f87171]"
                  : "bg-[#f59e0b] animate-pulse-dot",
            )}
          />
          <span className="text-[10px] font-mono hidden md:block">
            {apiStatus === "connected"
              ? "registry ok"
              : apiStatus === "error"
                ? "unreachable"
                : "connecting…"}
          </span>
        </span>
        {sorted.slice(0, 2).map((item) => (
          <span key={item.id} className="truncate max-w-50">
            {item.text}
          </span>
        ))}
        <div className="flex-1" />
        {state.commands.length > 0 && <span>{state.commands.length} cmds</span>}
        <span>v1.0.0</span>
      </footer>
    </>
  );
}
