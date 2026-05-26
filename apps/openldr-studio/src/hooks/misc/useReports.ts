import { useState, useEffect, useCallback } from "react";
import type {
  AntibiogramResponse,
  PriorityPathogensResponse,
  SurveillanceResponse,
  WorkloadResponse,
  GeographicResponse,
  DataQualityResponse,
  ReportQuery,
} from "../../types/reports";

const ENV = import.meta.env;

// ── Generic fetch hook ────────────────────────────────────────

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useReportFetch<T>(
  token: string,
  endpoint: string,
  query: Partial<ReportQuery>,
  signal?: AbortSignal,
): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (query.facility_id) params.set("facility_id", query.facility_id);
  if (query.date_from) params.set("date_from", query.date_from);
  if (query.date_to) params.set("date_to", query.date_to);
  if (query.guideline) params.set("guideline", query.guideline);
  if (query.min_isolates)
    params.set("min_isolates", String(query.min_isolates));

  const url = `/api/v1/reports/${endpoint}?${params.toString()}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ENV.VITE_API_BASE_URL}${url}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = (await res.json()) as T;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// ── Typed hooks per report ────────────────────────────────────

export function useAntibiogram(
  token: string,
  q: Partial<ReportQuery>,
  signal?: AbortSignal,
): FetchState<AntibiogramResponse> {
  return useReportFetch<AntibiogramResponse>(token, "antibiogram", q, signal);
}
export function usePriorityPathogens(
  token: string,
  q: Partial<ReportQuery>,
  signal?: AbortSignal,
) {
  return useReportFetch<PriorityPathogensResponse>(
    token,
    "priority-pathogens",
    q,
    signal,
  );
}
export function useSurveillance(
  token: string,
  q: Partial<ReportQuery>,
  signal?: AbortSignal,
) {
  return useReportFetch<SurveillanceResponse>(token, "surveillance", q, signal);
}
export function useWorkload(
  token: string,
  q: Partial<ReportQuery>,
  signal?: AbortSignal,
) {
  return useReportFetch<WorkloadResponse>(token, "workload", q, signal);
}
export function useGeographic(
  token: string,
  q: Partial<ReportQuery>,
  signal?: AbortSignal,
) {
  return useReportFetch<GeographicResponse>(token, "geographic", q, signal);
}
export function useDataQuality(
  token: string,
  q: Partial<ReportQuery>,
  signal?: AbortSignal,
) {
  return useReportFetch<DataQualityResponse>(token, "data-quality", q, signal);
}
