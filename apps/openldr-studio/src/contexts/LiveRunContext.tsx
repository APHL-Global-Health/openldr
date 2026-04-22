import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getMessageEvents,
  getMessageStatus,
  type LiveEvent,
} from "@/lib/restClients/dataProcessingRestClient";
import { useKeycloakClient } from "@/components/react-keycloak-provider";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LiveRunState {
  messageId: string;
  events: LiveEvent[];
  polling: boolean;
  done: boolean;
  failed: boolean;
  startedAt: number;
  lastEventAt: number | null;
}

interface LiveRunContextValue {
  activeRun: LiveRunState | null;
  stalenessSeconds: number;
  sheetOpen: boolean;
  startRun: (messageId: string) => void;
  openSheet: () => void;
  closeSheet: () => void;
}

// ── Terminal detection ───────────────────────────────────────────────────────

export function detectTerminal(events: LiveEvent[]): {
  done: boolean;
  failed: boolean;
} {
  const hasFailed = events.some(
    (e) => e.status === "failed" || e.eventType === "DLQ_QUEUED",
  );

  const countOf = (eventType: string) =>
    events.find((e) => e.eventType === eventType)?.count ?? 0;

  const validatedCount = countOf("VALIDATION_COMPLETED");
  const outpostCount = countOf("OUTPOST_COMPLETED");
  const storageCount = countOf("STORAGE_COMPLETED");

  const finalCount = outpostCount || storageCount;

  // All validated records reached the final stage
  if (validatedCount > 0 && finalCount >= validatedCount) {
    return { done: true, failed: hasFailed };
  }

  // Nothing passed validation and we have failures — everything failed
  if (validatedCount === 0 && hasFailed) {
    return { done: true, failed: true };
  }

  // Records still flowing through the pipeline
  return { done: false, failed: hasFailed };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "START_RUN"; messageId: string }
  | { type: "UPDATE_EVENTS"; events: LiveEvent[] }
  | { type: "RUN_DONE"; failed: boolean }
  | { type: "SET_SHEET"; open: boolean };

interface ReducerState {
  activeRun: LiveRunState | null;
  sheetOpen: boolean;
}

function reducer(s: ReducerState, a: Action): ReducerState {
  switch (a.type) {
    case "START_RUN":
      return {
        ...s,
        activeRun: {
          messageId: a.messageId,
          events: [],
          polling: true,
          done: false,
          failed: false,
          startedAt: Date.now(),
          lastEventAt: null,
        },
        sheetOpen: false,
      };
    case "UPDATE_EVENTS":
      return s.activeRun
        ? {
            ...s,
            activeRun: {
              ...s.activeRun,
              events: a.events,
              lastEventAt: a.events.length > 0 ? Date.now() : s.activeRun.lastEventAt,
            },
          }
        : s;
    case "RUN_DONE":
      return s.activeRun
        ? {
            ...s,
            activeRun: {
              ...s.activeRun,
              polling: false,
              done: true,
              failed: a.failed,
            },
          }
        : s;
    case "SET_SHEET":
      return { ...s, sheetOpen: a.open };
    default:
      return s;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

const LiveRunCtx = createContext<LiveRunContextValue | null>(null);

export function useLiveRun(): LiveRunContextValue {
  const ctx = useContext(LiveRunCtx);
  if (!ctx) throw new Error("useLiveRun must be used within LiveRunProvider");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function LiveRunProvider({ children }: { children: ReactNode }) {
  const client = useKeycloakClient();
  const tokenRef = useRef(client.kc.token);
  tokenRef.current = client.kc.token;

  const [state, dispatch] = useReducer(reducer, {
    activeRun: null,
    sheetOpen: false,
  });

  const [stalenessSeconds, setStalenessSeconds] = useState(0);

  // ── Polling ──
  useEffect(() => {
    const messageId = state.activeRun?.messageId;
    if (!messageId || !state.activeRun?.polling) return;

    let stopped = false;
    let prevSnapshot = "";
    let unchangedPolls = 0;

    const poll = async () => {
      if (stopped) return;
      try {
        const data = await getMessageEvents(messageId, tokenRef.current ?? "");
        if (stopped) return;

        // Only dispatch update if events actually changed (compare counts too,
        // since aggregated events keep the same array length but update counts)
        const snapshot = JSON.stringify(data.events.map((e) => `${e.stage}:${e.status}:${e.count}`));
        if (snapshot !== prevSnapshot) {
          prevSnapshot = snapshot;
          unchangedPolls = 0;
          dispatch({ type: "UPDATE_EVENTS", events: data.events });
        } else {
          unchangedPolls++;
        }

        const { done, failed } = detectTerminal(data.events);
        if (done) {
          stopped = true;
          dispatch({ type: "RUN_DONE", failed });
          return;
        }

        // If events haven't changed for 5 consecutive polls (~10s),
        // check the actual run status — it may be deleted or completed
        if (unchangedPolls >= 5) {
          unchangedPolls = 0;
          try {
            const status = await getMessageStatus(messageId, tokenRef.current ?? "");
            if (status.status === "deleted" || status.status === "completed" || status.status === "failed") {
              stopped = true;
              dispatch({ type: "RUN_DONE", failed: status.status === "failed" || status.status === "deleted" });
            }
          } catch {
            // status check failed — keep polling events
          }
        }
      } catch {
        // Network error — keep polling
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [state.activeRun?.messageId, state.activeRun?.polling]);

  // ── Staleness timer ──
  useEffect(() => {
    if (!state.activeRun?.polling) {
      setStalenessSeconds(0);
      return;
    }

    const id = setInterval(() => {
      const lastEvent = state.activeRun?.lastEventAt;
      const ref = lastEvent ?? state.activeRun?.startedAt ?? Date.now();
      setStalenessSeconds(Math.floor((Date.now() - ref) / 1000));
    }, 1000);

    return () => clearInterval(id);
  }, [state.activeRun?.polling, state.activeRun?.lastEventAt, state.activeRun?.startedAt]);

  const startRun = useCallback(
    (messageId: string) => dispatch({ type: "START_RUN", messageId }),
    [],
  );

  const openSheet = useCallback(
    () => dispatch({ type: "SET_SHEET", open: true }),
    [],
  );

  const closeSheet = useCallback(
    () => dispatch({ type: "SET_SHEET", open: false }),
    [],
  );

  return (
    <LiveRunCtx.Provider
      value={{
        activeRun: state.activeRun,
        stalenessSeconds,
        sheetOpen: state.sheetOpen,
        startRun,
        openSheet,
        closeSheet,
      }}
    >
      {children}
    </LiveRunCtx.Provider>
  );
}
