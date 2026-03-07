// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/lib/api/plugin-test.api.ts
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Project,
  UseCase,
  DataFeed,
  Plugin,
  RunPluginTestRequest,
  RunPluginTestResponse,
  SavePluginAssignmentRequest,
  SavePluginAssignmentResponse,
  CreateProjectRequest,
  CreateUseCaseRequest,
  CreateDataFeedRequest,
  CreatePluginRequest,
  PluginSlotType,
} from "@/types/plugin-test.types";

const BASE =
  (import.meta.env.VITE_API_URL ?? "http://localhost:3001") +
  "/api/plugin-tests";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const json = await res.json();
  if (!res.ok || json.ok === false)
    throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

// ── Context ───────────────────────────────────────────────────────────────────

export const pluginTestApi = {
  getProjects: () =>
    request<{ projects: Project[] }>("/projects").then((r) => r.projects),

  createProject: (name: string) =>
    request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name } satisfies CreateProjectRequest),
    }).then((r) => r.project),

  getUseCases: (projectId: string) =>
    request<{ useCases: UseCase[] }>(`/projects/${projectId}/use-cases`).then(
      (r) => r.useCases,
    ),

  createUseCase: (name: string, projectId: string) =>
    request<{ useCase: UseCase }>("/use-cases", {
      method: "POST",
      body: JSON.stringify({ name, projectId } satisfies CreateUseCaseRequest),
    }).then((r) => r.useCase),

  getDataFeeds: (useCaseId: string) =>
    request<{ feeds: DataFeed[] }>(`/use-cases/${useCaseId}/feeds`).then(
      (r) => r.feeds,
    ),

  createDataFeed: (name: string, useCaseId: string) =>
    request<{ feed: DataFeed }>("/feeds", {
      method: "POST",
      body: JSON.stringify({ name, useCaseId } satisfies CreateDataFeedRequest),
    }).then((r) => r.feed),

  // ── Plugins ──

  getPlugins: (slot: PluginSlotType) =>
    request<{ plugins: Plugin[] }>(`/plugins?slot=${slot}`).then(
      (r) => r.plugins,
    ),

  createPlugin: (data: CreatePluginRequest) =>
    request<{ plugin: Plugin }>("/plugins", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.plugin),

  // ── Test runner ──

  runTest: (data: RunPluginTestRequest): Promise<RunPluginTestResponse> =>
    request<RunPluginTestResponse>("/run", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Assignments ──

  saveAssignment: (
    data: SavePluginAssignmentRequest,
  ): Promise<SavePluginAssignmentResponse> =>
    request<SavePluginAssignmentResponse>("/assignments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getAssignment: (feedId: string) =>
    request<{
      assignment: ReturnType<
        typeof import("@/lib/restClients/pluginTestClient").pluginTestApi.getAssignment
      >;
    }>(`/assignments/${feedId}`),
};
