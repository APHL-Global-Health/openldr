import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  MessagePartPrimitive,
  ActionBarPrimitive,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  PlayIcon,
  SquareIcon,
  CopyIcon,
  CheckIcon,
  RefreshCwIcon,
  WrenchIcon,
  ChevronDownIcon,
  BrainIcon,
  LightbulbIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUGGESTED_MODELS } from "@/components/chat/chat-model-selector";
import { useModelStore } from "@/store/model-store";
import { cn } from "@/lib/utils";
import { useState, type FC } from "react";

// ── Thread (top-level) ──────────────────────────────────────────────────────

export const Thread: FC = () => {

  return (
    <ThreadPrimitive.Root className="flex min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] flex-col">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
        <ThreadPrimitive.Empty>
          <ThreadEmpty />
        </ThreadPrimitive.Empty>

        <div className="mx-auto px-4 md:px-8 py-8 space-y-6">
          <ThreadPrimitive.Messages
            components={{ UserMessage, AssistantMessage }}
          />
        </div>

        <div className="min-h-8 shrink-0" />
      </ThreadPrimitive.Viewport>

      <ThreadComposer />
    </ThreadPrimitive.Root>
  );
};

// ── Empty state ─────────────────────────────────────────────────────────────

const ThreadEmpty: FC = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 md:px-8">
      <div className="w-full max-w-3xl space-y-9 -mt-12">
        <div className="space-y-4 text-center">
          <p className="text-2xl text-foreground">
            Tell me everything you need
          </p>
        </div>
      </div>
    </div>
  );
};

// ── User message ────────────────────────────────────────────────────────────

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="w-full">
      <div className="w-full">
        <div className="flex items-center gap-2 mb-1 justify-end">
          <span className="text-xs font-semibold text-primary">You</span>
        </div>
        <div className="rounded-md border border-border px-4 py-3">
          <MessagePrimitive.Content
            components={{
              Text: () => (
                <MessagePartPrimitive.Text
                  component="p"
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                />
              ),
            }}
          />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

// ── Assistant message ───────────────────────────────────────────────────────

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="w-full">
      <div className="relative group w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-muted-foreground">
            Assistant
          </span>
        </div>
        <div className="text-sm leading-relaxed">
          <MessagePrimitive.Content
            components={{
              Text: AssistantTextPart,
              Reasoning: ReasoningPart,
              Empty: AssistantLoadingPart,
              tools: { Fallback: ToolCallPart },
            }}
          />
        </div>
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantLoadingPart: FC = () => {
  const thinkingEnabled = useModelStore((s) => s.thinkingEnabled);

  return (
    <MessagePrimitive.If last>
      <ThreadPrimitive.If running>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="size-2 rounded-full bg-primary animate-pulse" />
          {thinkingEnabled ? "Thinking..." : "Searching..."}
        </div>
      </ThreadPrimitive.If>
    </MessagePrimitive.If>
  );
};

const ReasoningPart: FC<{ text: string }> = ({ text }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 overflow-hidden my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/40 transition-colors"
      >
        <LightbulbIcon className="size-3.5 text-amber-500 shrink-0" />
        <span className="font-medium text-muted-foreground">Thinking</span>
        <ChevronDownIcon
          className={cn(
            "size-3 ml-auto transition-transform text-muted-foreground",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 bg-background/50">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {text}
          </p>
        </div>
      )}
    </div>
  );
};

const AssistantTextPart: FC = () => {
  return (
    <div className="aui-md">
      <MarkdownTextPrimitive
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      />
    </div>
  );
};

const ToolCallPart: FC<{
  toolName: string;
  args: Record<string, unknown>;
  argsText: string;
}> = ({ toolName, args }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 overflow-hidden my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
      >
        <WrenchIcon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium text-foreground">{toolName}</span>
        <span className="text-muted-foreground ml-auto flex items-center gap-1">
          {Object.keys(args).length} arg
          {Object.keys(args).length !== 1 && "s"}
          <ChevronDownIcon
            className={cn(
              "size-3 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 bg-background/50">
          <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

// ── Action bar (copy/reload) ────────────────────────────────────────────────

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <ActionBarPrimitive.Copy asChild>
        <Button variant="ghost" size="icon-sm" className="size-7">
          <MessagePrimitive.If copied>
            <CheckIcon className="size-3.5" />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon className="size-3.5" />
          </MessagePrimitive.If>
        </Button>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <Button variant="ghost" size="icon-sm" className="size-7">
          <RefreshCwIcon className="size-3.5" />
        </Button>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

// ── Composer (input area) ───────────────────────────────────────────────────

const ThreadComposer: FC = () => {
  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const isLoadingModel = useModelStore((s) => s.isLoadingModel);
  const thinkingEnabled = useModelStore((s) => s.thinkingEnabled);
  const setThinkingEnabled = useModelStore((s) => s.setThinkingEnabled);
  const hasModel = !!loadedModelId && !isLoadingModel;

  // Check if loaded model supports thinking
  const modelSupportsThinking = SUGGESTED_MODELS.find(
    (m) => m.id === loadedModelId,
  )?.supportsThinking ?? false;

  return (
    <div className="border-border px-4 pb-4 pt-2">
      <div className="w-full mx-auto">
        <ComposerPrimitive.Root className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-1.5">
          {/* Thinking toggle — only for models that support it */}
          {modelSupportsThinking && (
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                "size-7 shrink-0 rounded-full",
                thinkingEnabled && "text-amber-500 bg-amber-500/10",
              )}
              onClick={() => setThinkingEnabled(!thinkingEnabled)}
              title={thinkingEnabled ? "Thinking enabled" : "Thinking disabled"}
            >
              <BrainIcon className="size-4" />
            </Button>
          )}

          <ComposerPrimitive.Input
            autoFocus
            placeholder={
              isLoadingModel
                ? "Loading model..."
                : hasModel
                ? "Ask anything..."
                : "Load a model to start..."
            }
            rows={1}
            className={cn(
              "flex-1 resize-none border-0 bg-transparent text-sm",
              "placeholder:text-muted-foreground/60 focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          />

          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0 rounded-full"
              >
                <PlayIcon className="size-4" />
              </Button>
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>

          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0 rounded-full"
              >
                <SquareIcon className="size-3.5" />
              </Button>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
};
