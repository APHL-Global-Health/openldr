"use client";

import { useChatStore } from "@/store/chat-store";
import { DatabaseIcon, LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shows a "Querying data..." indicator while the agent is calling an MCP tool.
 * Drop this just above the messages scroll area in ChatConversationView:
 *
 *   {isGenerating && <AgentStatusIndicator />}
 */
export function AgentStatusIndicator() {
  const agentStatus = useChatStore((s) => s.agentStatus);
  const lastToolCall = useChatStore((s) => s.lastToolCall);
  const isGenerating = useChatStore((s) => s.isGenerating);

  if (!isGenerating || !agentStatus) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 mx-4 mb-2 rounded-md",
        "bg-muted/50 border border-border/50 text-sm text-muted-foreground",
        "animate-in fade-in slide-in-from-bottom-2 duration-200"
      )}
    >
      <LoaderIcon className="size-3.5 shrink-0 animate-spin text-primary" />
      <span className="flex-1">{agentStatus}</span>
      {lastToolCall && (
        <span className="flex items-center gap-1 text-xs font-mono bg-background px-2 py-0.5 rounded border">
          <DatabaseIcon className="size-3" />
          {lastToolCall.tool}
        </span>
      )}
    </div>
  );
}
