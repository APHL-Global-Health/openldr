import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  XIcon,
  PaperclipIcon,
  CircleDashedIcon,
  SparklesIcon,
  StopCircleIcon,
  SendIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { ChatMessage } from "./chat-message";
import { useChatStore } from "@/store/chat-store";
import { useModelStore } from "@/store/model-store";
import { GenerationError } from "@/components/chat/chat-generation-error";

interface ChatConversationViewProps {
  chatId: string;
  message: string;
  onMessageChange: (value: string) => void;
  onReset: () => void;
}

export function ChatConversationView({
  chatId,
  message,
  onMessageChange,
  onReset,
}: ChatConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useChatStore(
    (s) => s.chats.find((c) => c.id === chatId)?.messages ?? [],
  );
  const isGenerating = useChatStore((s) => s.isGenerating);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const loadedModelId = useModelStore((s) => s.loadedModelId);

  // Auto-scroll to bottom whenever messages change or tokens arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const content = message.trim();
    if (!content || isGenerating) return;
    sendMessage(chatId, content);
    onMessageChange("");
  };

  const canSend = message.trim().length > 0 && !isGenerating && !!loadedModelId;

  const showTools = true;
  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">
        <div className="max-w-160 mx-auto space-y-6">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <GenerationError chatId={chatId} />
          {/* Anchor for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border px-2 md:px-2 py-2">
        <div className="w-full">
          {/* No model loaded warning */}
          {!loadedModelId && (
            <p className="text-xs text-muted-foreground text-center mb-2">
              No model loaded — select and load a model from the model picker
            </p>
          )}

          <div className="rounded-xs border border-border bg-secondary dark:bg-card p-1">
            <div className="rounded-xs border border-border dark:border-transparent bg-card dark:bg-secondary">
              <Textarea
                placeholder={
                  loadedModelId
                    ? "Continue the conversation..."
                    : "Load a model to start chatting..."
                }
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                disabled={isGenerating || !loadedModelId}
                className="min-h-20 resize-none border-0 bg-transparent px-4 py-3 text-base placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />

              <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 rounded-full border border-border dark:border-input bg-card dark:bg-secondary hover:bg-accent"
                  >
                    <PaperclipIcon className="size-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-7 rounded-full border border-border dark:border-input bg-card dark:bg-secondary hover:bg-accent px-3"
                  >
                    <CircleDashedIcon className="size-4 text-muted-foreground" />
                    <span className="hidden sm:inline text-sm text-muted-foreground/70">
                      Deep Search
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-7 rounded-full border border-border dark:border-input bg-card dark:bg-secondary hover:bg-accent px-3"
                  >
                    <SparklesIcon className="size-4 text-muted-foreground" />
                    <span className="hidden sm:inline text-sm text-muted-foreground/70">
                      Think
                    </span>
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="h-7 px-4 gap-1.5"
                >
                  {isGenerating ? (
                    <>
                      <StopCircleIcon className="size-3.5" />
                      <span>Generating</span>
                    </>
                  ) : (
                    <>
                      <SendIcon className="size-3.5" />
                      <span>Send</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
