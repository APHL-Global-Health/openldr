import {
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import type {
  ToolCallMessagePart,
  TextMessagePart,
  ReasoningMessagePart,
  ChatModelRunResult,
} from "@assistant-ui/react";
import { useModelStore } from "@/store/model-store";
import { useState, useCallback, useRef } from "react";
import {
  loadThreads,
  saveThreads,
  loadMessages,
  saveMessages,
  deleteMessages,
  toThreadMessageLike,
  type PersistedThread,
  type PersistedMessage,
} from "@/store/chat-persistence";

type ContentPart = TextMessagePart | ToolCallMessagePart | ReasoningMessagePart;

// ── Think tag parser ────────────────────────────────────────────────────────

function parseThinkTags(
  rawText: string,
  enableThinking: boolean,
): { text: string; reasoning: string | null } {
  if (!enableThinking) {
    // Strip any <think> tags entirely
    const stripped = rawText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return { text: stripped, reasoning: null };
  }

  // Extract reasoning from <think>...</think>
  const thinkMatch = rawText.match(/<think>([\s\S]*?)(<\/think>|$)/);
  const reasoning = thinkMatch ? thinkMatch[1].trim() : null;
  const text = rawText.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
  return { text, reasoning };
}

// ── SSE streaming adapter ───────────────────────────────────────────────────

async function* streamFromBackend(
  messages: PersistedMessage[],
  abortSignal: AbortSignal,
  enableThinking: boolean,
): AsyncGenerator<ChatModelRunResult, void, unknown> {
  const res = await fetch(`/ai/chat/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_new_tokens: enableThinking ? 2048 : 512,
      temperature: 0,
      stream: true,
      enable_thinking: enableThinking,
    }),
    signal: abortSignal,
  });

  if (!res.ok) {
    throw new Error(`Agent stream error ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let rawText = "";
  let reasoningText = "";
  let toolCallCounter = 0;
  const toolCalls: ContentPart[] = [];

  const buildContent = (): ChatModelRunResult => {
    const parts: ContentPart[] = [];
    // Check for <think> tags in the raw text (model-generated reasoning)
    const { text, reasoning: parsedReasoning } = parseThinkTags(rawText, enableThinking);
    // Combine backend reasoning (tool routing) + model reasoning (think tags)
    const allReasoning = [reasoningText, parsedReasoning].filter(Boolean).join("\n\n");
    if (allReasoning) {
      parts.push({ type: "reasoning" as const, text: allReasoning });
    }
    if (text) parts.push({ type: "text" as const, text });
    parts.push(...toolCalls);
    return { content: parts };
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      if (parsed.done) {
        yield buildContent();
        return;
      }
      if (parsed.error) {
        throw new Error(String(parsed.error));
      }
      if (parsed.tool_call) {
        const tc = parsed.tool_call as {
          tool: string;
          args: Record<string, unknown>;
        };
        toolCallCounter++;
        const argsText = JSON.stringify(tc.args, null, 2);
        toolCalls.push({
          type: "tool-call" as const,
          toolCallId: `tc-${toolCallCounter}`,
          toolName: tc.tool,
          args: tc.args as ToolCallMessagePart["args"],
          argsText,
        });
        yield buildContent();
      }
      if (parsed.reasoning) {
        reasoningText = String(parsed.reasoning);
        yield buildContent();
      }
      if (parsed.token) {
        rawText += parsed.token;
        yield buildContent();
      }
    }
  }

  yield buildContent();
}

// ── Hook ────────────────────────────────────────────────────────────────────

function makeId() {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useOpenLDRRuntime() {
  // Thread list state
  const [threads, setThreads] = useState<PersistedThread[]>(() =>
    loadThreads(),
  );
  const [currentThreadId, setCurrentThreadId] = useState<string>(() => {
    const saved = loadThreads();
    const regular = saved.filter((t) => t.status === "regular");
    return regular.length > 0 ? regular[0].id : makeId();
  });

  // Messages for current thread
  const [messages, setMessages] = useState<PersistedMessage[]>(() =>
    loadMessages(currentThreadId),
  );
  // Live streaming message with full content parts (reasoning, tool calls, etc.)
  const [streamingMessage, setStreamingMessage] =
    useState<ThreadMessageLike | null>(null);
  const streamingThreadRef = useRef<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const persistMessages = useCallback(
    (threadId: string, msgs: PersistedMessage[]) => {
      if (threadId === currentThreadId) {
        setMessages(msgs);
      }
      saveMessages(threadId, msgs);
    },
    [currentThreadId],
  );

  // Ensure current thread exists in list
  const ensureThread = useCallback((threadId: string) => {
    setThreads((prev) => {
      if (prev.some((t) => t.id === threadId)) return prev;
      const now = new Date().toISOString();
      const updated = [
        {
          id: threadId,
          title: "New chat",
          status: "regular" as const,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ];
      saveThreads(updated);
      return updated;
    });
  }, []);

  // ── Thread list callbacks ───────────────────────────────────────────────

  const onSwitchToNewThread = useCallback(() => {
    const id = makeId();
    ensureThread(id);
    setCurrentThreadId(id);
    setMessages([]);
    setStreamingMessage(null);
  }, [ensureThread]);

  const onSwitchToThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
    setMessages(loadMessages(threadId));
    setStreamingMessage(null);
  }, []);

  const onRename = useCallback((threadId: string, newTitle: string) => {
    setThreads((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId
          ? { ...t, title: newTitle, updatedAt: new Date().toISOString() }
          : t,
      );
      saveThreads(updated);
      return updated;
    });
  }, []);

  const onArchive = useCallback((threadId: string) => {
    setThreads((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, status: "archived" as const } : t,
      );
      saveThreads(updated);
      return updated;
    });
  }, []);

  const onUnarchive = useCallback((threadId: string) => {
    setThreads((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, status: "regular" as const } : t,
      );
      saveThreads(updated);
      return updated;
    });
  }, []);

  const onDelete = useCallback(
    (threadId: string) => {
      setThreads((prev) => {
        const updated = prev.filter((t) => t.id !== threadId);
        saveThreads(updated);
        return updated;
      });
      deleteMessages(threadId);
      if (threadId === currentThreadId) {
        onSwitchToNewThread();
      }
    },
    [currentThreadId, onSwitchToNewThread],
  );

  // ── Message handling ──────────────────────────────────────────────────────

  const onNew = useCallback(
    async (message: {
      content: readonly { type: string; text?: string }[];
    }) => {
      const modelId = useModelStore.getState().loadedModelId;
      if (!modelId) {
        throw new Error("No model loaded. Please load a model first.");
      }

      // Extract user text
      const userText =
        message.content
          ?.filter((p) => p.type === "text")
          .map((p) => p.text || "")
          .join("") || "";

      // Ensure thread exists
      ensureThread(currentThreadId);

      // Add user message
      const updatedMessages: PersistedMessage[] = [
        ...messages,
        { role: "user" as const, content: userText },
      ];
      persistMessages(currentThreadId, updatedMessages);

      // Auto-title from first user message
      setThreads((prev) => {
        const thread = prev.find((t) => t.id === currentThreadId);
        if (thread && thread.title === "New chat") {
          const title = userText.slice(0, 50).trim();
          const displayTitle =
            title.length < userText.length ? title + "…" : title;
          const updated = prev.map((t) =>
            t.id === currentThreadId
              ? {
                  ...t,
                  title: displayTitle,
                  updatedAt: new Date().toISOString(),
                }
              : t,
          );
          saveThreads(updated);
          return updated;
        }
        return prev;
      });

      // Stream assistant response
      setIsRunning(true);
      const controller = new AbortController();
      abortRef.current = controller;
      streamingThreadRef.current = currentThreadId;

      let assistantText = "";
      try {
        const thinkingOn = useModelStore.getState().thinkingEnabled;
        for await (const result of streamFromBackend(
          updatedMessages,
          controller.signal,
          thinkingOn,
        )) {
          // Set live streaming message with full content parts (reasoning, tool calls)
          setStreamingMessage({
            role: "assistant",
            content: result.content as ThreadMessageLike["content"],
          });

          // Extract plain text for persistence
          const textPart = result.content?.find((p) => p.type === "text") as
            | TextMessagePart
            | undefined;
          if (textPart) {
            assistantText = textPart.text;
          }

          // Yield to event loop so React can render each token
          await new Promise((r) => setTimeout(r, 0));
        }

        // Clear streaming message and persist final result
        setStreamingMessage(null);
        const finalMessages = [
          ...updatedMessages,
          { role: "assistant" as const, content: assistantText },
        ];
        persistMessages(currentThreadId, finalMessages);
      } catch (err) {
        setStreamingMessage(null);
        if ((err as Error).name !== "AbortError") {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          console.error("[chat] streaming error:", errMsg);
          const errorMessages = [
            ...updatedMessages,
            {
              role: "assistant" as const,
              content: `Error: ${errMsg}`,
            },
          ];
          persistMessages(currentThreadId, errorMessages);
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
      }
    },
    [messages, currentThreadId, ensureThread, persistMessages],
  );

  const onCancel = useCallback(async () => {
    abortRef.current?.abort();
  }, []);

  // ── Convert persisted messages to ThreadMessageLike ────────────────────

  const threadMessages: ThreadMessageLike[] = messages
    .filter((m: PersistedMessage) => m.content)
    .map(toThreadMessageLike);

  // Append live streaming message (with full content parts) during generation
  if (streamingMessage && isRunning && streamingThreadRef.current === currentThreadId) {
    threadMessages.push(streamingMessage);
  }

  // ── Build runtime ─────────────────────────────────────────────────────

  return useExternalStoreRuntime({
    isRunning,
    messages: threadMessages,
    convertMessage: (msg: ThreadMessageLike) => msg,
    onNew,
    onCancel,
    adapters: {
      threadList: {
        threadId: currentThreadId,
        threads: threads
          .filter((t) => t.status === "regular")
          .map((t) => ({
            id: t.id,
            status: "regular" as const,
            title: t.title,
          })),
        archivedThreads: threads
          .filter((t) => t.status === "archived")
          .map((t) => ({
            id: t.id,
            status: "archived" as const,
            title: t.title,
          })),
        onSwitchToNewThread,
        onSwitchToThread,
        onRename,
        onArchive,
        onUnarchive,
        onDelete,
      },
    },
  });
}
