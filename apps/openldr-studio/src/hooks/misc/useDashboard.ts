import { useCallback, useEffect, useReducer, useRef } from "react";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import type {
  DashboardFilters,
  DashboardData,
  DatePreset,
} from "@/types/database";
import {
  getLabDashboard,
  getInfraDashboard,
} from "@/lib/restClients/dashboardRestClient";

// ---- Helpers ----

function getDateRangeForPreset(preset: DatePreset): {
  from: string;
  to: string;
} {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (preset) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return { from: from.toISOString(), to };
}

// ---- State ----

export type DashboardTab = "laboratory" | "infrastructure";

interface DashboardState {
  loading: boolean;
  error: string | null;
  filters: DashboardFilters;
  datePreset: DatePreset;
  activeTab: DashboardTab;
  data: DashboardData | null;
  refreshCount: number;
}

type DashboardAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_DATA"; payload: Partial<DashboardData> }
  | { type: "SET_FILTERS"; payload: Partial<DashboardFilters> }
  // | { type: "SET_DATE_PRESET"; payload: DatePreset }
  // | { type: "SET_CUSTOM_DATE_RANGE"; payload: { from: string; to: string } }
  | { type: "SET_TAB"; payload: DashboardTab }
  | { type: "REFRESH" };

const initialFilters: DashboardFilters = {
  dateRange: getDateRangeForPreset("today"),
  database: "openldr_external",
};

const initialState: DashboardState = {
  loading: true,
  error: null,
  filters: initialFilters,
  datePreset: "today",
  activeTab: "laboratory",
  data: null,
  refreshCount: 0,
};

function reducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_DATA":
      return {
        ...state,
        // Merge partial data into existing data so switching tabs
        // doesn't wipe out data from the other tab
        data: { ...state.data, ...action.payload } as DashboardData,
        loading: false,
        error: null,
      };
    case "SET_FILTERS":
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      };
    // case "SET_DATE_PRESET": {
    //   const dateRange = getDateRangeForPreset(action.payload);
    //   return {
    //     ...state,
    //     datePreset: action.payload,
    //     filters: { ...state.filters, dateRange },
    //   };
    // }
    // case "SET_CUSTOM_DATE_RANGE":
    //   return {
    //     ...state,
    //     datePreset: "custom",
    //     filters: { ...state.filters, dateRange: action.payload },
    //   };
    case "SET_TAB":
      return { ...state, activeTab: action.payload };
    case "REFRESH":
      return { ...state, refreshCount: state.refreshCount + 1 };
    default:
      return state;
  }
}

// ---- Hook ----

export function useDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const client = useKeycloakClient();
  const keycloak = client.kc;
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!keycloak.authenticated || !keycloak.token) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const token = keycloak.token;
      const filters = state.filters;
      const signal = controller.signal;

      // Only fetch data for the active tab — this is ONE request, not 11
      let result: Partial<DashboardData>;

      if (state.activeTab === "laboratory") {
        result = await getLabDashboard(token, filters, signal);
        if (!signal.aborted) {
          dispatch({ type: "SET_DATA", payload: result });
        }
      } else if (state.activeTab === "infrastructure") {
        result = await getInfraDashboard(token, filters, signal);
        if (!signal.aborted) {
          dispatch({ type: "SET_DATA", payload: result });
        }
      } else if (!signal.aborted) {
        dispatch({ type: "SET_DATA", payload: {} });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Dashboard data load error:", err);

      // Attempt token refresh
      try {
        await keycloak.updateToken(30);
      } catch {
        keycloak.login();
        return;
      }

      dispatch({
        type: "SET_ERROR",
        payload: err?.message || "Failed to load dashboard data",
      });
    }
  }, [keycloak, state.filters, state.activeTab]);

  // Fetch on mount + whenever filters, tab, or refreshCount change
  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData, state.refreshCount]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "REFRESH" });
    }, 300_000);
    return () => clearInterval(interval);
  }, []);

  return {
    ...state,
    // setDatePreset: (preset: DatePreset) =>
    //   dispatch({ type: "SET_DATE_PRESET", payload: preset }),
    // setCustomDateRange: (from: string, to: string) =>
    //   dispatch({ type: "SET_CUSTOM_DATE_RANGE", payload: { from, to } }),
    setFilters: (filters: Partial<DashboardFilters>) =>
      dispatch({ type: "SET_FILTERS", payload: filters }),
    setActiveTab: (tab: DashboardTab) =>
      dispatch({ type: "SET_TAB", payload: tab }),
    refresh: () => dispatch({ type: "REFRESH" }),
  };
}
