import { cn } from "@/lib/utils";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant"; // changed from sender: "user" | "ai"
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-4", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "rounded-md px-4 py-3 max-w-[80%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary",
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
          {/* Blinking cursor — only shown while tokens are streaming in */}
          {message.isStreaming && (
            <span
              className="inline-flex items-center gap-0.5 ml-1 translate-y-0.5"
              aria-hidden="true"
            >
              <span className="w-1 h-1 rounded-full bg-current animate-[bounce_0.6s_ease-in-out_infinite] [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-current animate-[bounce_0.6s_ease-in-out_infinite] [animation-delay:100ms]" />
              <span className="w-1 h-1 rounded-full bg-current animate-[bounce_0.6s_ease-in-out_infinite] [animation-delay:200ms]" />
            </span>
          )}
        </p>

        {/* Show timestamp only once streaming is done */}
        {!message.isStreaming && (
          <p
            className={cn(
              "text-xs mt-1.5 select-none",
              isUser
                ? "text-primary-foreground/60"
                : "text-muted-foreground/60",
            )}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
