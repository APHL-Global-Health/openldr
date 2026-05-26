import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StageProgressView } from "./StageProgressView";
import { useLiveRun } from "@/contexts/LiveRunContext";

export function LiveRunSheet() {
  const { activeRun, stalenessSeconds, sheetOpen, closeSheet } = useLiveRun();

  if (!activeRun) return null;

  const elapsed = Math.floor((Date.now() - activeRun.startedAt) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
      <SheetContent side="right" className="p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm">Live Run</SheetTitle>
          <SheetDescription className="text-[10px] font-mono">
            {activeRun.messageId.slice(0, 8)}&hellip;
            {" — "}
            {activeRun.done
              ? activeRun.failed
                ? "Failed"
                : "Completed"
              : activeRun.failed
                ? `Running — errors detected (${elapsedStr})`
                : `Running (${elapsedStr})`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <StageProgressView
            messageId={activeRun.messageId}
            events={activeRun.events}
            polling={activeRun.polling}
            done={activeRun.done}
            failed={activeRun.failed}
            stalenessSeconds={stalenessSeconds}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
