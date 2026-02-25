"use client";

import { useChatStore } from "@/store/chat-store";
import { useModelStore } from "@/store/model-store";

import { useEffect, useState } from "react";
import { ChatWelcomeScreen } from "./chat-welcome-screen";
import { ChatConversationView } from "./chat-conversation-view";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface ChatMainViewProps {
  resetKey: number;
}

export function ChatMain({ resetKey }: ChatMainViewProps) {
  const [message, setMessage] = useState("");

  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const createNewChat = useChatStore((s) => s.createNewChat);
  const resetToWelcome = useChatStore((s) => s.resetToWelcome);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const currentChat = useChatStore(
    (s) => s.chats.find((c) => c.id === s.selectedChatId) ?? null,
  );
  const loadedModelId = useModelStore((s) => s.loadedModelId);

  // Reset when parent triggers a new chat
  useEffect(() => {
    resetToWelcome();
    setMessage("");
  }, [resetKey]);

  const handleSend = () => {
    const content = message.trim();
    if (!content) return;

    // Create a new chat if none is selected
    let chatId = selectedChatId;
    if (!chatId) {
      createNewChat();
      // After createNewChat, selectedChatId is updated in the store —
      // read it directly from getState() since useState is async
      chatId = useChatStore.getState().selectedChatId;
    }

    if (!chatId) return;
    sendMessage(chatId, content);
    setMessage("");
  };

  // Show conversation view if a chat with messages is selected
  const hasMessages = (currentChat?.messages.length ?? 0) > 0;

  if (hasMessages && selectedChatId) {
    return (
      <ChatConversationView
        chatId={selectedChatId}
        message={message}
        onMessageChange={setMessage}
        onReset={() => setMessage("")}
      />
    );
  }

  return (
    <ChatWelcomeScreen
      message={message}
      onMessageChange={setMessage}
      onSend={handleSend}
    />
  );
}
