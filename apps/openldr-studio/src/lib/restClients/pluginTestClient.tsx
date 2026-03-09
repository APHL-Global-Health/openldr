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
  DataFeedPluginAssignment,
} from "@/types/plugin-test.types";

const ENV = import.meta.env;
// const IsDev = ENV.MODE === "development";

async function request<T>(
  token: any,
  path: string,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(
    `${ENV.VITE_PROCESSOR_BASE_URL}/api/v1/projects${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal,
      ...init,
    },
  );
  const json = await res.json();
  if (!res.ok || json.ok === false)
    throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

// ── Context ───────────────────────────────────────────────────────────────────

export const pluginTestApi = {
  getProjects: (token: any, signal?: AbortSignal) =>
    request<{ projects: Project[] }>(token, "", undefined, signal).then(
      (r) => r.projects,
    ),

  createProject: (token: any, name: string, signal?: AbortSignal) =>
    request<{ project: Project }>(
      token,
      "",
      {
        method: "POST",
        body: JSON.stringify({ name } satisfies CreateProjectRequest),
      },
      signal,
    ).then((r) => r.project),

  getUseCases: (token: any, projectId: string, signal?: AbortSignal) =>
    request<{ useCases: UseCase[] }>(
      token,
      `/${projectId}/use-cases`,
      undefined,
      signal,
    ).then((r) => r.useCases),

  createUseCase: (
    token: any,
    name: string,
    projectId: string,
    signal?: AbortSignal,
  ) =>
    request<{ useCase: UseCase }>(
      token,
      "/use-cases",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          projectId,
        } satisfies CreateUseCaseRequest),
      },
      signal,
    ).then((r) => r.useCase),

  getDataFeeds: (token: any, useCaseId: string, signal?: AbortSignal) =>
    request<{ feeds: DataFeed[] }>(
      token,
      `/use-cases/${useCaseId}/feeds`,
      undefined,
      signal,
    ).then((r) => r.feeds),

  createDataFeed: (
    token: any,
    name: string,
    useCaseId: string,
    signal?: AbortSignal,
  ) =>
    request<{ feed: DataFeed }>(
      token,
      "/feeds",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          useCaseId,
        } satisfies CreateDataFeedRequest),
      },
      signal,
    ).then((r) => r.feed),

  // ── Plugins ──

  getPlugins: (token: any, slot: PluginSlotType, signal?: AbortSignal) =>
    request<{ plugins: Plugin[] }>(
      token,
      `/plugins?slot=${slot}`,
      undefined,
      signal,
    ).then((r) => r.plugins),

  createPlugin: (token: any, data: CreatePluginRequest, signal?: AbortSignal) =>
    request<{ plugin: Plugin }>(
      token,
      "/plugins",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      signal,
    ).then((r) => r.plugin),

  // ── Test runner ──

  runTest: (
    token: any,
    data: RunPluginTestRequest,
    signal?: AbortSignal,
  ): Promise<RunPluginTestResponse> =>
    request<RunPluginTestResponse>(
      token,
      "/run",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      signal,
    ),

  // ── Assignments ──

  saveAssignment: (
    token: any,
    data: SavePluginAssignmentRequest,
    signal?: AbortSignal,
  ): Promise<SavePluginAssignmentResponse> =>
    request<SavePluginAssignmentResponse>(
      token,
      "/assignments",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      signal,
    ),

  getAssignment: (token: any, feedId: string, signal?: AbortSignal) =>
    request<{ assignment: DataFeedPluginAssignment }>(
      token,
      `/assignments/${feedId}`,
      undefined,
      signal,
    ).then((r) => r.assignment),
};
