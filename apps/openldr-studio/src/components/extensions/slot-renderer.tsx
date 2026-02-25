import { useExtensions } from "@/hooks/misc/useExtensions";
import { types } from "@openldr/extensions";
import { Layers } from "lucide-react";
import { IframeView } from "@/components/extensions/iframeview";

export function SlotRenderer({ slot }: { slot: types.ExtensionSlot }) {
  const { state } = useExtensions();
  const active = state.extensions.filter(
    (e) => e.state === "active" && e.slot === slot,
  );

  if (active.length === 0)
    return (
      <div className="flex flex-1  border-l border-border flex-col items-center justify-center gap-3 text-center p-8">
        <div className="h-14 w-14 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
          <Layers className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-[11px] font-mono text-muted-foreground">
            slot: <span className="text-[#f59e0b]/40">{slot}</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Enable an extension to populate this slot
          </p>
        </div>
      </div>
    );

  return (
    <div className="flex flex-1 border-l border-border overflow-hidden flex-col">
      {active.map((ext) => (
        <IframeView key={ext.id} extId={ext.id} />
      ))}
    </div>
  );
}
