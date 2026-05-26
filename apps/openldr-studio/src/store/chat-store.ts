import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  agentChat,
  type ChatMessage as AIChatMessage,
} from "@/lib/restClients/aiRestClient";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean; // true while tokens are still arriving
}

export interface Chat {
  id: string;
  title: string;
  icon: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
}

interface ChatState {
  chats: Chat[];
  selectedChatId: string | null;
  isGenerating: boolean;
  generationError: string | null;
  agentStatus: string | null;
  lastToolCall: { tool: string; args: Record<string, unknown> } | null;

  resetToWelcome: () => void;

  // Navigation
  selectChat: (chatId: string) => void;
  createNewChat: () => void;

  // Messaging
  sendMessage: (chatId: string, content: string) => Promise<void>;

  // Management
  archiveChat: (chatId: string) => void;
  unarchiveChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  clearGenerationError: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildAIMessages(messages: Message[]): AIChatMessage[] {
  return messages
    .filter((m) => !m.isStreaming || m.content.length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      selectedChatId: null,
      isGenerating: false,
      generationError: null,
      agentStatus: null,
      lastToolCall: null,

      resetToWelcome: () => set({ selectedChatId: null }),

      selectChat: (chatId) => set({ selectedChatId: chatId }),

      createNewChat: () => {
        const newChat: Chat = {
          id: `chat-${makeId()}`,
          title: "New Conversation",
          icon: "message-circle-dashed",
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isArchived: false,
        };
        set((state) => ({
          chats: [newChat, ...state.chats],
          selectedChatId: newChat.id,
        }));
      },

      sendMessage: async (chatId: string, content: string) => {
        const userMessage: Message = {
          id: `msg-${makeId()}`,
          role: "user",
          content,
          timestamp: new Date(),
        };

        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: [...c.messages, userMessage],
                  updatedAt: new Date(),
                }
              : c,
          ),
          isGenerating: true,
          generationError: null,
          agentStatus: null,
          lastToolCall: null,
        }));

        const assistantId = `msg-${makeId()}`;
        const placeholder: Message = {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isStreaming: true,
        };

        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId
              ? { ...c, messages: [...c.messages, placeholder] }
              : c,
          ),
        }));

        try {
          const chat = get().chats.find((c) => c.id === chatId)!;
          const history = chat.messages
            .filter(
              (m) =>
                m.id !== assistantId &&
                (!m.isStreaming || m.content.length > 0),
            )
            .map((m) => ({ role: m.role, content: m.content }));

          // Use agentChat - handles tool calls automatically
          for await (const event of agentChat(history)) {
            if (event.type === "token" && event.token) {
              set((state) => ({
                chats: state.chats.map((c) =>
                  c.id === chatId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantId
                            ? { ...m, content: m.content + event.token }
                            : m,
                        ),
                      }
                    : c,
                ),
                agentStatus: null, // clear status once tokens flow
              }));
            }

            if (event.type === "status") {
              set({
                agentStatus: event.status ?? null,
                lastToolCall: event.toolCall ?? null,
              });
            }

            if (event.type === "error") {
              throw new Error(event.error);
            }
          }

          // Mark streaming done
          set((state) => ({
            chats: state.chats.map((c) =>
              c.id === chatId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantId ? { ...m, isStreaming: false } : m,
                    ),
                    updatedAt: new Date(),
                  }
                : c,
            ),
            isGenerating: false,
            agentStatus: null,
            lastToolCall: null,
          }));

          // Auto-title from first message
          const updatedChat = get().chats.find((c) => c.id === chatId);
          if (updatedChat?.title === "New Conversation") {
            const first = updatedChat.messages.find((m) => m.role === "user");
            if (first) {
              const title = first.content.slice(0, 50).trim();
              get().updateChatTitle(
                chatId,
                title.length < first.content.length ? title + "…" : title,
              );
            }
          }
        } catch (err) {
          set((state) => ({
            chats: state.chats.map((c) =>
              c.id === chatId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content:
                              "Sorry, I encountered an error. Please try again.",
                            isStreaming: false,
                          }
                        : m,
                    ),
                  }
                : c,
            ),
            isGenerating: false,
            agentStatus: null,
            lastToolCall: null,
            generationError:
              err instanceof Error ? err.message : "Generation failed",
          }));
        }
      },

      archiveChat: (chatId) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, isArchived: true } : c,
          ),
        })),

      unarchiveChat: (chatId) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, isArchived: false } : c,
          ),
        })),

      deleteChat: (chatId) =>
        set((state) => ({
          chats: state.chats.filter((c) => c.id !== chatId),
          selectedChatId:
            state.selectedChatId === chatId ? null : state.selectedChatId,
        })),

      updateChatTitle: (chatId, title) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, title } : c,
          ),
        })),

      clearGenerationError: () => set({ generationError: null }),
    }),

    {
      name: "openldr-chat-store",
      // Serialize/deserialize Date objects
      storage: {
        getItem: (key) => {
          const value = localStorage.getItem(key);
          if (!value) return null;
          return JSON.parse(value, (_, v) => {
            if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
              return new Date(v);
            }
            return v;
          });
        },
        setItem: (key, value) =>
          localStorage.setItem(key, JSON.stringify(value)),
        removeItem: (key) => localStorage.removeItem(key),
      },
    },
  ),
);
