"use client";

import { useChatStore } from "@/store/chat-store";
import { useModelStore } from "@/store/model-store";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

interface GenerationErrorProps {
  chatId: string;
}

/**
 * Shown below the last message when generation fails mid-stream.
 * Retries by resending the last user message.
 *
 * Drop this in ChatConversationView just after the messages.map():
 *   <GenerationError chatId={chatId} />
 */
export function GenerationError({ chatId }: GenerationErrorProps) {
  const generationError = useChatStore((s) => s.generationError);
  const messages = useChatStore(
    (s) => s.chats.find((c) => c.id === chatId)?.messages ?? []
  );
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearGenerationError = useChatStore((s) => s.clearGenerationError);
  const loadedModelId = useModelStore((s) => s.loadedModelId);

  if (!generationError) return null;

  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  const handleRetry = () => {
    if (!lastUserMessage || !loadedModelId) return;
    clearGenerationError();
    sendMessage(chatId, lastUserMessage.content);
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-destructive/5 border border-destructive/20">
      <AlertCircleIcon className="size-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-destructive font-medium">Generation failed</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {generationError}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRetry}
        disabled={!lastUserMessage || !loadedModelId}
        className="gap-1.5 shrink-0 border-destructive/30 hover:bg-destructive/10"
      >
        <RefreshCwIcon className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}
