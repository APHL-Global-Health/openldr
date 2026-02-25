import {
  PaperclipIcon,
  CircleDashedIcon,
  SparklesIcon,
  ChevronDownIcon,
  StopCircleIcon,
  SendIcon,
  AlertCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ModelSelector } from "@/components/chat/chat-model-selector";
import { ModelLoadingIndicator } from "@/components/chat/chat-model-loading-indicator";
import { useModelStore } from "@/store/model-store";
import { useChatStore } from "@/store/chat-store";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface ChatInputBoxProps {
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  // selectedModel: string;
  // onModelChange: (modelId: string) => void;
  showTools?: boolean;
  placeholder?: string;
}

export function ChatInputBox({
  message,
  onMessageChange,
  onSend,
  // selectedModel,
  // onModelChange,
  showTools = true,
  placeholder = "Ask anything...",
}: ChatInputBoxProps) {
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);

  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const isLoadingModel = useModelStore((s) => s.isLoadingModel);
  const isGenerating = useChatStore((s) => s.isGenerating);

  const hasModel = !!loadedModelId && !isLoadingModel;
  const modelLabel = loadedModelId
    ? loadedModelId.split("/").pop()
    : "Select model";

  const handleSendOrGuard = () => {
    if (!hasModel) {
      // No model loaded — open the Sheet instead of silently failing
      sheetTriggerRef.current?.click();
      return;
    }
    onSend();
  };

  const canSend = message.trim().length > 0 && hasModel && !isGenerating;

  return (
    <div className="rounded-xs border border-border bg-secondary dark:bg-card p-1">
      <div className="rounded-xs border border-border dark:border-transparent bg-card dark:bg-secondary">
        {/* No model warning banner */}
        {!loadedModelId && !isLoadingModel && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <AlertCircleIcon className="size-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-muted-foreground">
              No model loaded —{" "}
              <Sheet>
                <SheetTrigger asChild>
                  <button className="underline underline-offset-2 hover:text-foreground transition-colors">
                    select a model
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 overflow-y-auto">
                  <SheetHeader className="mb-4">
                    <SheetTitle>AI Model</SheetTitle>
                  </SheetHeader>
                  <ModelLoadingIndicator />
                  <ModelSelector />
                </SheetContent>
              </Sheet>{" "}
              to start chatting.
            </p>
          </div>
        )}

        <Textarea
          placeholder={
            isLoadingModel
              ? "Loading model, please wait..."
              : hasModel
                ? placeholder
                : "Load a model to start chatting..."
          }
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          disabled={isGenerating || isLoadingModel}
          className={cn(
            "min-h-30 resize-none border-0 bg-transparent px-4 py-3 text-base",
            "placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendOrGuard();
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
            {showTools && (
              <>
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
              </>
            )}
          </div>

          {showTools ? (
            <div className="flex items-center gap-2">
              {/* Model selector Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    ref={sheetTriggerRef}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 h-5 px-0 hover:bg-transparent",
                      !hasModel && "text-amber-500",
                    )}
                  >
                    <span className="hidden sm:inline text-sm">
                      {isLoadingModel ? "Loading..." : modelLabel}
                    </span>
                    <ChevronDownIcon className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 overflow-y-auto">
                  <SheetHeader className="mb-4">
                    <SheetTitle>AI Model</SheetTitle>
                  </SheetHeader>
                  <ModelLoadingIndicator />
                  <ModelSelector />
                </SheetContent>
              </Sheet>

              {/* Send button */}
              <Button
                size="sm"
                onClick={handleSendOrGuard}
                disabled={isGenerating || isLoadingModel || !message.trim()}
                className="h-7 px-4 gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <StopCircleIcon className="size-3.5" />
                    Generating
                  </>
                ) : (
                  <>
                    <SendIcon className="size-3.5" />
                    Send
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleSendOrGuard}
              disabled={!message.trim() || isLoadingModel}
              className="h-7 px-4"
            >
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
