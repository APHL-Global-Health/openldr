import { useExtensions } from "@/hooks/misc/useExtensions";
import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command } from "lucide-react";
import { Badge } from "@/components/extensions/badge";
import { Separator } from "@/components/ui/separator";

export function CommandPalette() {
  const { state, dispatch, host } = useExtensions();
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.commandPaletteOpen) {
      setFilter("");
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [state.commandPaletteOpen]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        dispatch({ type: "TOGGLE_PALETTE" });
      }
      if (e.key === "Escape") dispatch({ type: "CLOSE_PALETTE" });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [dispatch]);

  if (!state.commandPaletteOpen) return null;

  const builtinCmds = [
    {
      id: "__refresh",
      title: "Broadcast data.refresh to all extensions",
      extensionId: "host",
    },
    { id: "__console", title: "Toggle Dev Console", extensionId: "host" },
  ];
  const all = [...builtinCmds, ...state.commands].filter(
    (c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-9997 flex items-start justify-center pt-[14vh]"
      onClick={(e) =>
        e.target === e.currentTarget && dispatch({ type: "CLOSE_PALETTE" })
      }
    >
      <div className="w-135 bg-[#0d0f16] border border-[#1e2232] rounded-xs shadow-2xl shadow-black/80 overflow-hidden">
        {/* search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2232]">
          <Command className="h-4 w-4 text-[#475569] shrink-0" />
          <input
            ref={inputRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Type a command…"
            className="flex-1 bg-transparent text-sm text-[#e2e8f0] placeholder:text-[#2d3652] focus:outline-none font-sans"
          />
          <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-[#1e2232] text-[10px] font-mono text-[#475569] bg-[#161923]">
            ESC
          </kbd>
        </div>

        <ScrollArea className="max-h-72">
          {all.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#2d3652] font-mono">
              No matching commands
            </p>
          ) : (
            all.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => {
                  if (cmd.id === "__refresh") host.invokeCommand("__refresh");
                  else if (cmd.id === "__console")
                    dispatch({ type: "TOGGLE_DEV" });
                  else host.invokeCommand(cmd.id);
                  dispatch({ type: "CLOSE_PALETTE" });
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#161923] transition-colors text-left group"
              >
                <span className="text-[12px] text-[#94a3b8] group-hover:text-[#e2e8f0] font-sans transition-colors">
                  {cmd.title}
                </span>
                <Badge variant="default" className="shrink-0 ml-3">
                  {cmd.extensionId}
                </Badge>
              </button>
            ))
          )}
        </ScrollArea>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-[#1e2232] bg-[#080a0f]">
          <span className="text-[10px] font-mono text-[#2d3652]">
            {all.length} commands
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span className="text-[10px] font-mono text-[#2d3652]">
            {state.extensions.filter((e) => e.state === "active").length}{" "}
            extensions active
          </span>
        </div>
      </div>
    </div>
  );
}
