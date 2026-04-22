import { useEffect, useRef } from "react";
import { useAssistantRuntime, useThreadRuntime } from "@assistant-ui/react";

/**
 * Auto-titles a thread based on the first user message,
 * similar to ChatGPT / Claude behavior.
 * Runs once per thread after the first assistant response completes.
 */
export function useAutoTitle() {
  const threadRuntime = useThreadRuntime();
  const assistantRuntime = useAssistantRuntime();
  const hasTitled = useRef<Set<string>>(new Set());

  useEffect(() => {
    return threadRuntime.subscribe(() => {
      const state = threadRuntime.getState();
      if (!state || state.isRunning) return;

      const threads = assistantRuntime.threads;
      const threadId = threads.getState().mainThreadId;
      if (!threadId || hasTitled.current.has(threadId)) return;

      const messages = state.messages;
      if (messages.length < 2) return;

      const firstUser = messages.find((m) => m.role === "user");
      if (!firstUser) return;

      const textPart = firstUser.content?.find((p) => p.type === "text");
      if (!textPart || textPart.type !== "text") return;

      const title = textPart.text.slice(0, 50).trim();
      const displayTitle =
        title.length < textPart.text.length ? title + "…" : title;

      hasTitled.current.add(threadId);
      threads.getItemById(threadId).rename(displayTitle);
    });
  }, [threadRuntime, assistantRuntime]);
}
