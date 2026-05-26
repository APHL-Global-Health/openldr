import type { LiveEvent } from "./dataProcessingRestClient";

const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";
const BASE = `${ENV.VITE_PROCESSOR_BASE_URL}/api/v1/runs`;

export interface PipelineRun {
  messageId: string;
  projectId: string;
  dataFeedId: string | null;
  userId: string | null;
  currentStage: string;
  currentStatus: string;
  rawObjectPath: string | null;
  validatedObjectPath: string | null;
  mappedObjectPath: string | null;
  processedObjectPath: string | null;
  errorStage: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  projectName: string | null;
  dataFeedName: string | null;
  sourceHash: string | null;
  fileSize: number | null;
  contentType: string | null;
}

export interface PipelineRunDetail {
  run: PipelineRun & { errorDetails: Record<string, any> | null };
  events: LiveEvent[];
  fileHash: {
    hash: string;
    sourceObjectPath: string | null;
    fileSize: number | null;
    contentType: string | null;
  } | null;
}

export interface RunsListResponse {
  data: PipelineRun[];
  total: number;
  page: number;
  limit: number;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(
      `HTTP error ${response.status}: ${response.statusText}${
        IsDev ? ` - ${await response.text()}` : ""
      }`,
    );
  }
  return response.json();
}

export async function listRuns(
  token: string,
  params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    status?: string;
    projectId?: string;
    dataFeedId?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  signal?: AbortSignal,
): Promise<RunsListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const response = await fetch(`${BASE}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return handleResponse(response);
}

export async function getRunDetail(
  token: string,
  messageId: string,
  signal?: AbortSignal,
): Promise<PipelineRunDetail> {
  const response = await fetch(`${BASE}/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return handleResponse(response);
}

export async function retryRun(
  token: string,
  messageId: string,
  signal?: AbortSignal,
): Promise<{ success: boolean; sourceTopic: string; replayedAt: string }> {
  const response = await fetch(`${BASE}/${messageId}/retry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return handleResponse(response);
}

export async function deleteRun(
  token: string,
  messageId: string,
  signal?: AbortSignal,
): Promise<{ messageId: string; status: string; deleted: string[]; errors: string[] }> {
  const response = await fetch(`${BASE}/${messageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return handleResponse(response);
}

export async function purgeObjects(
  token: string,
  bucket: string,
  prefix: string,
  signal?: AbortSignal,
): Promise<{ deletedCount: number }> {
  const qs = new URLSearchParams({ bucket, prefix });
  const response = await fetch(`${BASE}/objects/purge?${qs}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return handleResponse(response);
}
