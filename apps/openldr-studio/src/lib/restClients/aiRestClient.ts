/**
 * Typed API client for the openldr-ai service.
 * All requests go through /ai (proxied by nginx to the FastAPI container).
 */

const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

// ── Types matching the FastAPI schemas ──────────────────────────────────────

export type DownloadStatus = "idle" | "downloading" | "ready" | "error";

export interface ModelDownloadStatus {
  model_id: string;
  status: DownloadStatus;
  progress: number; // 0-100
  downloaded_gb: number;
  total_gb: number;
  error: string | null;
  loaded: boolean;
}

export interface AvailableModel {
  model_id: string;
  size_gb: number;
  downloaded_at: string | null;
  loaded: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  loaded_model: string | null;
}

// ── API calls ────────────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${ENV.VITE_AI_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const aiClient = {
  health(): Promise<HealthResponse> {
    return request("/health");
  },

  downloadModel(
    modelId: string,
  ): Promise<{ message: string; model_id: string }> {
    return request("/models/download", {
      method: "POST",
      body: JSON.stringify({ model_id: modelId }),
    });
  },

  getDownloadStatus(modelId: string): Promise<ModelDownloadStatus> {
    // Encode slashes in model IDs like "Qwen/Qwen2.5-0.5B-Instruct"
    return request(`/models/status/${encodeURIComponent(modelId)}`);
  },

  listModels(): Promise<AvailableModel[]> {
    return request("/models");
  },

  loadModel(modelId: string): Promise<{ message: string }> {
    return request("/models/load", {
      method: "POST",
      body: JSON.stringify({ model_id: modelId }),
    });
  },

  getLoadedModel(): Promise<{ loaded: boolean; model_id: string | null }> {
    return request("/models/loaded");
  },

  /**
   * Streaming chat via SSE.
   * Returns an async generator that yields tokens as they arrive.
   * Usage:
   *   for await (const token of aiClient.streamChat(messages)) {
   *     setResponse(prev => prev + token)
   *   }
   */
  async *streamChat(
    messages: ChatMessage[],
    options?: { maxNewTokens?: number; temperature?: number },
  ): AsyncGenerator<string, void, unknown> {
    const res = await fetch(`${ENV.VITE_AI_BASE_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        max_new_tokens: options?.maxNewTokens ?? 512,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Chat stream error ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.done) return;
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.token) yield parsed.token as string;
        } catch {
          // skip malformed lines
        }
      }
    }
  },
};

export interface AgentStreamEvent {
  type: "token" | "status" | "tool_call" | "done" | "error";
  token?: string;
  status?: string;
  toolCall?: { tool: string; args: Record<string, unknown> };
  error?: string;
}

// Add this method to aiClient in lib/ai-client.ts:
export async function* agentChat(
  messages: ChatMessage[],
  options?: { maxNewTokens?: number; temperature?: number },
): AsyncGenerator<AgentStreamEvent, void, unknown> {
  const res = await fetch(`/ai/chat/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      max_new_tokens: options?.maxNewTokens ?? 512,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Agent stream error ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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

      try {
        const parsed = JSON.parse(data);

        if (parsed.done) {
          yield { type: "done" };
          return;
        }
        if (parsed.error) {
          yield { type: "error", error: parsed.error };
          return;
        }
        if (parsed.token) {
          yield { type: "token", token: parsed.token };
        }
        if (parsed.status) {
          yield {
            type: "status",
            status: parsed.status,
            toolCall: parsed.tool_call
              ? { tool: parsed.tool_call.tool, args: parsed.tool_call.args }
              : undefined,
          };
        }
      } catch {
        // skip malformed
      }
    }
  }
}
