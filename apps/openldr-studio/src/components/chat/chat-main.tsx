import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useOpenLDRRuntime } from "./chat-runtime-provider";
import { Thread } from "./chat-thread";
import { ChatThreadList } from "./chat-thread-list";
import { GridPattern } from "@/components/grid-pattern";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatMain() {
  const runtime = useOpenLDRRuntime();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex w-full h-full overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            "flex flex-col border-r border-border bg-sidebar transition-all duration-200 overflow-hidden",
            sidebarOpen ? "w-64 min-w-64" : "w-0 min-w-0",
          )}
        >
          <ChatThreadList />
        </div>

        {/* Collapse toggle on border */}
        <div className="relative z-20 flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 -ml-3 rounded-full border border-border bg-background hover:bg-accent"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? (
              <ChevronLeftIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )}
          </Button>
        </div>

        {/* Main thread area */}
        <div className="flex flex-1 flex-col overflow-hidden relative">
          <GridPattern className="pointer-events-none" />
          <div className="relative z-10 h-full w-full">
            <Thread />
          </div>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
