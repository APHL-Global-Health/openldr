import type { DashboardFilters, DashboardData } from "@/types/database";

const ENV = import.meta.env;

function buildQueryParams(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  params.set("startDateTime", filters.dateRange.from);
  params.set("endDateTime", filters.dateRange.to);
  if (filters.facilityCode) params.set("facilityCode", filters.facilityCode);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.useCaseId) params.set("useCaseId", filters.useCaseId);
  return params.toString();
}

async function apiFetch<T>(
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${ENV.VITE_API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}${ENV.MODE === "development" ? ` - ${text}` : ""}`,
    );
  }

  return response.json();
}

// ============================================================
// Aggregated Endpoints
// These replace the previous 11 individual API calls with
// a single request to avoid rate limiting issues.
// ============================================================

/**
 * Fetch the full dashboard payload in one request.
 * Returns the entire DashboardData shape.
 */
export async function getFullDashboard(
  token: string,
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<DashboardData> {
  const qs = buildQueryParams(filters);
  return apiFetch<DashboardData>(`/api/v1/dashboard?${qs}`, token, signal);
}

/**
 * Fetch only lab-related dashboard data.
 * Use when the user is on the "Laboratory" tab.
 */
export async function getLabDashboard(
  token: string,
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<
  Pick<
    DashboardData,
    | "kpi"
    | "labActivity"
    | "specimenDistribution"
    | "testPanelVolume"
    | "resultFlagDistribution"
    | "facilityActivity"
    | "recentResults"
  >
> {
  const qs = buildQueryParams(filters);
  return apiFetch(`/api/v1/dashboard/laboratory?${qs}`, token, signal);
}

/**
 * Fetch only infrastructure dashboard data.
 * Use when the user is on the "Infrastructure" tab.
 */
export async function getInfraDashboard(
  token: string,
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<
  Pick<DashboardData, "pipeline" | "services" | "storage" | "databases">
> {
  const qs = buildQueryParams(filters);
  return apiFetch(`/api/v1/dashboard/infrastructure?${qs}`, token, signal);
}
