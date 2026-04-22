import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CopyIcon,
  CheckIcon,
  AlertCircleIcon,
  WrenchIcon,
  ChevronDownIcon,
} from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";
import {
  parseMessageContent,
  type ContentSegment,
} from "./chat-content-parser";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
}

function MessageCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "absolute -bottom-7 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded",
        "text-xs text-muted-foreground hover:text-foreground transition-all",
        "opacity-0 group-hover:opacity-100",
      )}
    >
      {copied ? (
        <CheckIcon className="size-3" />
      ) : (
        <CopyIcon className="size-3" />
      )}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function ToolCallCard({
  tool,
  args,
}: {
  tool: string;
  args: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 overflow-hidden my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
      >
        <WrenchIcon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium text-foreground">{tool}</span>
        <span className="text-muted-foreground flex items-center gap-1">
          {Object.keys(args).length} arg{Object.keys(args).length !== 1 && "s"}
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
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 my-1.5">
      <AlertCircleIcon className="size-3.5 text-destructive shrink-0 mt-0.5" />
      <p className="text-xs text-destructive">{message}</p>
    </div>
  );
}

function AssistantContent({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const segments = useMemo(() => {
    // Don't parse while still streaming — the content may be incomplete
    if (isStreaming) return null;
    return parseMessageContent(content);
  }, [content, isStreaming]);

  // While streaming or if parser returned a single text segment, render directly
  if (!segments || (segments.length === 1 && segments[0].type === "text")) {
    return <MarkdownRenderer content={content} />;
  }

  return (
    <div className="space-y-1">
      {segments.map((seg, i) => {
        switch (seg.type) {
          case "text":
            return <MarkdownRenderer key={i} content={seg.value.trim()} />;
          case "tool_call":
            return <ToolCallCard key={i} tool={seg.tool} args={seg.args} />;
          case "error":
            return <ErrorCard key={i} message={seg.message} />;
        }
      })}
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Hide empty assistant bubbles (content hasn't arrived yet, tool is executing)
  if (!isUser && !message.content && message.isStreaming) {
    return null;
  }

  return (
    <div className="w-full">
      <div className={cn("relative group ", isUser ? "w-full" : "w-full")}>
        {/* Role label */}
        <div
          className={cn(
            "flex items-center gap-2 mb-1",
            isUser && "justify-end",
          )}
        >
          <span
            className={cn(
              "text-xs font-semibold",
              isUser ? "text-primary" : "text-muted-foreground",
            )}
          >
            {isUser ? "You" : "Assistant"}
          </span>
          {!message.isStreaming && (
            <span className="text-xs text-muted-foreground/50 select-none">
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {isUser ? (
          <div className="rounded-md border border-border px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
        ) : (
          <AssistantContent
            content={message.content}
            isStreaming={message.isStreaming}
          />
        )}

        {/* Copy button for assistant messages */}
        {!isUser && !message.isStreaming && message.content && (
          <MessageCopyButton text={message.content} />
        )}
      </div>
    </div>
  );
}
