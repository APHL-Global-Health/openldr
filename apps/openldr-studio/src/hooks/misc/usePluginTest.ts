import { useCallback, useEffect, useReducer, useRef } from "react";
import { pluginTestApi } from "@/lib/restClients/pluginTestClient";
import type {
  Project,
  UseCase,
  DataFeed,
  Plugin,
  RunPluginTestResponse,
  PluginSlotType,
} from "@/types/plugin-test.types";

// ── State ─────────────────────────────────────────────────────────────────────

interface PluginSelections {
  validation: string | undefined;
  mapping: string | undefined;
  outpost: string | undefined;
}

interface State {
  // Lists
  projects: Project[];
  useCases: UseCase[];
  dataFeeds: DataFeed[];
  plugins: Record<PluginSlotType, Plugin[]>;

  // Selections
  selectedProjectId: string | undefined;
  selectedUseCaseId: string | undefined;
  selectedFeedId: string | undefined;
  selectedPlugins: PluginSelections;

  // Payload
  payload: string;

  // Test execution
  runStatus:
    | "idle"
    | "running-validation"
    | "running-mapping"
    | "running-outpost"
    | "done"
    | "error";
  testResult: RunPluginTestResponse | undefined;

  // UI
  loadingCtx: boolean; // context dropdowns loading
  saving: boolean;
  savedOk: boolean;
  error: string | undefined;
}

type Action =
  | { type: "SET_PROJECTS"; projects: Project[] }
  | { type: "SET_USE_CASES"; useCases: UseCase[] }
  | { type: "SET_FEEDS"; feeds: DataFeed[] }
  | { type: "SET_PLUGINS"; slot: PluginSlotType; plugins: Plugin[] }
  | { type: "ADD_PROJECT"; project: Project }
  | { type: "ADD_USE_CASE"; useCase: UseCase }
  | { type: "ADD_FEED"; feed: DataFeed }
  | { type: "ADD_PLUGIN"; slot: PluginSlotType; plugin: Plugin }
  | { type: "SELECT_PROJECT"; id: string | undefined }
  | { type: "SELECT_USE_CASE"; id: string | undefined }
  | { type: "SELECT_FEED"; id: string | undefined }
  | { type: "SELECT_PLUGIN"; slot: PluginSlotType; id: string | undefined }
  | {
      type: "SET_ASSIGNMENT";
      validationPluginId: string | null;
      mappingPluginId: string | null;
      outpostPluginId: string | null;
    }
  | { type: "SET_PAYLOAD"; payload: string }
  | { type: "RUN_START" }
  | { type: "RUN_STAGE"; stage: "validation" | "mapping" }
  | { type: "RUN_DONE"; result: RunPluginTestResponse }
  | { type: "RUN_ERROR"; error: string }
  | { type: "SAVE_START" }
  | { type: "SAVE_DONE" }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "SET_LOADING_CTX"; loading: boolean }
  | { type: "CLEAR_ERROR" };

const initialState: State = {
  projects: [],
  useCases: [],
  dataFeeds: [],
  plugins: { validation: [], mapping: [], outpost: [] },
  selectedProjectId: undefined,
  selectedUseCaseId: undefined,
  selectedFeedId: undefined,
  selectedPlugins: {
    validation: undefined,
    mapping: undefined,
    outpost: undefined,
  },
  payload: "",
  runStatus: "idle",
  testResult: undefined,
  loadingCtx: false,
  saving: false,
  savedOk: false,
  error: undefined,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_PROJECTS":
      return { ...s, projects: a.projects };
    case "SET_USE_CASES":
      return { ...s, useCases: a.useCases };
    case "SET_FEEDS":
      return { ...s, dataFeeds: a.feeds };
    case "SET_PLUGINS":
      return { ...s, plugins: { ...s.plugins, [a.slot]: a.plugins } };

    case "ADD_PROJECT":
      return {
        ...s,
        projects: [...s.projects, a.project],
        selectedProjectId: a.project.projectId,
        selectedUseCaseId: undefined,
        selectedFeedId: undefined,
      };
    case "ADD_USE_CASE":
      return {
        ...s,
        useCases: [...s.useCases, a.useCase],
        selectedUseCaseId: a.useCase.useCaseId,
        selectedFeedId: undefined,
      };
    case "ADD_FEED":
      return {
        ...s,
        dataFeeds: [...s.dataFeeds, a.feed],
        selectedFeedId: a.feed.dataFeedId,
      };
    case "ADD_PLUGIN":
      return {
        ...s,
        plugins: { ...s.plugins, [a.slot]: [...s.plugins[a.slot], a.plugin] },
        selectedPlugins: { ...s.selectedPlugins, [a.slot]: a.plugin.pluginId },
      };

    case "SELECT_PROJECT":
      return {
        ...s,
        selectedProjectId: a.id,
        selectedUseCaseId: undefined,
        selectedFeedId: undefined,
        useCases: [],
        dataFeeds: [],
        selectedPlugins: {
          validation: undefined,
          mapping: undefined,
          outpost: undefined,
        },
        testResult: undefined,
        runStatus: "idle",
        savedOk: false,
      };
    case "SELECT_USE_CASE":
      return {
        ...s,
        selectedUseCaseId: a.id,
        selectedFeedId: undefined,
        dataFeeds: [],
        selectedPlugins: {
          validation: undefined,
          mapping: undefined,
          outpost: undefined,
        },
        testResult: undefined,
        runStatus: "idle",
        savedOk: false,
      };
    case "SELECT_FEED":
      return {
        ...s,
        selectedFeedId: a.id,
        selectedPlugins: {
          validation: undefined,
          mapping: undefined,
          outpost: undefined,
        },
        testResult: undefined,
        runStatus: "idle",
        savedOk: false,
      };
    case "SELECT_PLUGIN":
      return {
        ...s,
        selectedPlugins: { ...s.selectedPlugins, [a.slot]: a.id },
        testResult: undefined,
        runStatus: "idle",
        savedOk: false,
      };
    case "SET_ASSIGNMENT":
      return {
        ...s,
        selectedPlugins: {
          validation: a.validationPluginId ?? undefined,
          mapping: a.mappingPluginId ?? undefined,
          outpost: a.outpostPluginId ?? undefined,
        },
        testResult: undefined,
        runStatus: "idle",
        savedOk: false,
      };

    case "SET_PAYLOAD":
      return {
        ...s,
        payload: a.payload,
        testResult: undefined,
        runStatus: "idle",
        savedOk: false,
      };

    case "RUN_START":
      return {
        ...s,
        runStatus: "running-validation",
        testResult: undefined,
        savedOk: false,
        error: undefined,
      };
    case "RUN_STAGE":
      return {
        ...s,
        runStatus: a.stage === "validation" ? "running-mapping" : "done",
      };
    case "RUN_DONE":
      return { ...s, runStatus: "done", testResult: a.result };
    case "RUN_ERROR":
      return { ...s, runStatus: "error", error: a.error };

    case "SAVE_START":
      return { ...s, saving: true, error: undefined };
    case "SAVE_DONE":
      return { ...s, saving: false, savedOk: true };
    case "SAVE_ERROR":
      return { ...s, saving: false, error: a.error };

    case "SET_LOADING_CTX":
      return { ...s, loadingCtx: a.loading };
    case "CLEAR_ERROR":
      return { ...s, error: undefined };
    default:
      return s;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePluginTest(token: any, signal?: AbortSignal) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  // ── Boot: load projects + all plugin lists ──
  useEffect(() => {
    pluginTestApi
      .getProjects(token, signal)
      .then((p) => dispatch({ type: "SET_PROJECTS", projects: p }))
      .catch(() => {});
    (["validation", "mapping", "outpost"] as PluginSlotType[]).forEach((slot) =>
      pluginTestApi
        .getPlugins(token, slot, signal)
        .then((p) => dispatch({ type: "SET_PLUGINS", slot, plugins: p }))
        .catch(() => {}),
    );
  }, []);

  // ── Cascade: load use cases when project changes ──
  useEffect(() => {
    if (!state.selectedProjectId) return;
    dispatch({ type: "SET_LOADING_CTX", loading: true });
    pluginTestApi
      .getUseCases(token, state.selectedProjectId, signal)
      .then((u) => dispatch({ type: "SET_USE_CASES", useCases: u }))
      .finally(() => dispatch({ type: "SET_LOADING_CTX", loading: false }));
  }, [state.selectedProjectId]);

  // ── Cascade: load feeds when use case changes ──
  useEffect(() => {
    if (!state.selectedUseCaseId) return;
    pluginTestApi
      .getDataFeeds(token, state.selectedUseCaseId, signal)
      .then((f) => dispatch({ type: "SET_FEEDS", feeds: f }));
  }, [state.selectedUseCaseId]);

  // ── Cascade: load plugin assignment when feed changes ──
  useEffect(() => {
    if (!state.selectedFeedId) return;
    pluginTestApi
      .getAssignment(token, state.selectedFeedId, signal)
      .then((a) =>
        dispatch({
          type: "SET_ASSIGNMENT",
          validationPluginId: a.validationPluginId,
          mappingPluginId: a.mappingPluginId,
          outpostPluginId: a.outpostPluginId,
        }),
      )
      .catch(() => {
        // No assignment saved yet — leave plugins cleared
      });
  }, [state.selectedFeedId]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const refreshProjects = useCallback(() => {
    pluginTestApi
      .getProjects(token, signal)
      .then((p) => dispatch({ type: "SET_PROJECTS", projects: p }))
      .catch(() => {});
  }, [token, signal]);

  const refreshUseCases = useCallback(() => {
    if (!state.selectedProjectId) return;
    pluginTestApi
      .getUseCases(token, state.selectedProjectId, signal)
      .then((u) => dispatch({ type: "SET_USE_CASES", useCases: u }))
      .catch(() => {});
  }, [token, signal, state.selectedProjectId]);

  const refreshDataFeeds = useCallback(() => {
    if (!state.selectedUseCaseId) return;
    pluginTestApi
      .getDataFeeds(token, state.selectedUseCaseId, signal)
      .then((f) => dispatch({ type: "SET_FEEDS", feeds: f }))
      .catch(() => {});
  }, [token, signal, state.selectedUseCaseId]);

  const refreshPlugins = useCallback(() => {
    (["validation", "mapping", "outpost"] as PluginSlotType[]).forEach((slot) =>
      pluginTestApi
        .getPlugins(token, slot, signal)
        .then((p) => dispatch({ type: "SET_PLUGINS", slot, plugins: p }))
        .catch(() => {}),
    );
  }, [token, signal]);

  const createProject = useCallback(async (name: string) => {
    const p = await pluginTestApi.createProject(token, name, signal);
    dispatch({ type: "ADD_PROJECT", project: p });
  }, []);

  const createUseCase = useCallback(
    async (name: string) => {
      if (!state.selectedProjectId) return;
      const u = await pluginTestApi.createUseCase(
        token,
        name,
        state.selectedProjectId,
        signal,
      );
      dispatch({ type: "ADD_USE_CASE", useCase: u });
    },
    [state.selectedProjectId],
  );

  const createDataFeed = useCallback(
    async (name: string) => {
      if (!state.selectedUseCaseId) return;
      const f = await pluginTestApi.createDataFeed(
        token,
        name,
        state.selectedUseCaseId,
        signal,
      );
      dispatch({ type: "ADD_FEED", feed: f });
    },
    [state.selectedUseCaseId],
  );

  const createPlugin = useCallback(
    async (name: string, slot: PluginSlotType) => {
      const p = await pluginTestApi.createPlugin(token, { name, slot }, signal);
      dispatch({ type: "ADD_PLUGIN", slot, plugin: p });
    },
    [],
  );

  const runTest = useCallback(async () => {
    const { payload, selectedPlugins } = state;
    if (!payload.trim()) return;
    if (
      !selectedPlugins.validation &&
      !selectedPlugins.mapping &&
      !selectedPlugins.outpost
    )
      return;

    abortRef.current?.abort();
    dispatch({ type: "RUN_START" });

    try {
      const result = await pluginTestApi.runTest(
        token,
        {
          payload,
          validationPluginId: selectedPlugins.validation,
          mappingPluginId: selectedPlugins.mapping,
          outpostPluginId: selectedPlugins.outpost,
        },
        signal,
      );
      dispatch({ type: "RUN_DONE", result });
    } catch (e) {
      dispatch({ type: "RUN_ERROR", error: (e as Error).message });
    }
  }, [state]);

  const saveAssignment = useCallback(async () => {
    const { selectedFeedId, selectedPlugins } = state;
    if (!selectedFeedId) return;
    dispatch({ type: "SAVE_START" });
    try {
      await pluginTestApi.saveAssignment(
        token,
        {
          feedId: selectedFeedId,
          validationPluginId: selectedPlugins.validation!,
          mappingPluginId: selectedPlugins.mapping!,
          outpostPluginId: selectedPlugins.outpost!,
        },
        signal,
      );
      dispatch({ type: "SAVE_DONE" });
    } catch (e) {
      dispatch({ type: "SAVE_ERROR", error: (e as Error).message });
    }
  }, [state]);

  return {
    state,
    actions: {
      selectProject: (id: string | undefined) =>
        dispatch({ type: "SELECT_PROJECT", id }),
      selectUseCase: (id: string | undefined) =>
        dispatch({ type: "SELECT_USE_CASE", id }),
      selectFeed: (id: string | undefined) =>
        dispatch({ type: "SELECT_FEED", id }),
      selectPlugin: (slot: PluginSlotType, id: string | undefined) =>
        dispatch({ type: "SELECT_PLUGIN", slot, id }),
      setPayload: (payload: string) =>
        dispatch({ type: "SET_PAYLOAD", payload }),
      createProject,
      createUseCase,
      createDataFeed,
      createPlugin,
      runTest,
      saveAssignment,
      refreshProjects,
      refreshUseCases,
      refreshDataFeeds,
      refreshPlugins,
      clearError: () => dispatch({ type: "CLEAR_ERROR" }),
    },
  };
}
