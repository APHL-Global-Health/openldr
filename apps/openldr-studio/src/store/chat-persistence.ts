/**
 * localStorage-based persistence for assistant-ui chat threads.
 * Stores thread metadata and messages separately for efficient access.
 */

import type { ThreadMessageLike } from "@assistant-ui/react";

const STORAGE_KEY_THREADS = "openldr-chat-threads";
const STORAGE_KEY_MESSAGES = "openldr-chat-messages";

// ── Thread metadata ─────────────────────────────────────────────────────────

export interface PersistedThread {
  id: string;
  title: string;
  status: "regular" | "archived";
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export function loadThreads(): PersistedThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THREADS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: PersistedThread[]): void {
  localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(threads));
}

// ── Thread messages ─────────────────────────────────────────────────────────

export interface PersistedMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export function loadMessages(threadId: string): PersistedMessage[] {
  try {
    const all = JSON.parse(
      localStorage.getItem(STORAGE_KEY_MESSAGES) || "{}",
    );
    return all[threadId] || [];
  } catch {
    return [];
  }
}

export function saveMessages(
  threadId: string,
  messages: PersistedMessage[],
): void {
  try {
    const all = JSON.parse(
      localStorage.getItem(STORAGE_KEY_MESSAGES) || "{}",
    );
    all[threadId] = messages;
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(all));
  } catch {
    // localStorage full or unavailable
  }
}

export function deleteMessages(threadId: string): void {
  try {
    const all = JSON.parse(
      localStorage.getItem(STORAGE_KEY_MESSAGES) || "{}",
    );
    delete all[threadId];
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(all));
  } catch {
    // ignore
  }
}

// ── Conversion helpers ──────────────────────────────────────────────────────

export function toThreadMessageLike(msg: PersistedMessage): ThreadMessageLike {
  return {
    role: msg.role as "user" | "assistant",
    content: [{ type: "text" as const, text: msg.content }],
  };
}

export function fromThreadMessages(
  messages: readonly { role: string; content: readonly { type: string; text?: string }[] }[],
): PersistedMessage[] {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content:
      m.content
        ?.filter((p) => p.type === "text")
        .map((p) => p.text || "")
        .join("") || "",
  }));
}
