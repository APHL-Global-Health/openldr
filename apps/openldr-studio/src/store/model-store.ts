import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  aiClient,
  type DownloadStatus,
  type AvailableModel,
} from "@/lib/restClients/aiRestClient";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModelDownloadEntry {
  modelId: string;
  status: DownloadStatus;
  progress: number; // 0-100
  downloadedGb: number;
  totalGb: number;
  error: string | null;
}

interface ModelState {
  // The model currently loaded in the backend for inference
  loadedModelId: string | null;

  // Download tracking - keyed by model_id
  downloads: Record<string, ModelDownloadEntry>;

  // All models available on disk
  availableModels: AvailableModel[];

  // UI loading states
  isLoadingModel: boolean;
  loadError: string | null;

  // Actions
  startDownload: (modelId: string) => Promise<void>;
  pollDownloadStatus: (modelId: string) => Promise<void>;
  loadModel: (modelId: string) => Promise<void>;
  fetchAvailableModels: () => Promise<void>;
  syncLoadedModel: () => Promise<void>;
  clearDownloadError: (modelId: string) => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      loadedModelId: null,
      downloads: {},
      availableModels: [],
      isLoadingModel: false,
      loadError: null,

      startDownload: async (modelId: string) => {
        // Optimistically set downloading state so UI reacts immediately
        set((state) => ({
          downloads: {
            ...state.downloads,
            [modelId]: {
              modelId,
              status: "downloading",
              progress: 0,
              downloadedGb: 0,
              totalGb: 0,
              error: null,
            },
          },
        }));

        try {
          await aiClient.downloadModel(modelId);
          // Start polling after kick-off
          get().pollDownloadStatus(modelId);
        } catch (err) {
          set((state) => ({
            downloads: {
              ...state.downloads,
              [modelId]: {
                ...state.downloads[modelId],
                status: "error",
                error: err instanceof Error ? err.message : "Download failed",
              },
            },
          }));
        }
      },

      pollDownloadStatus: async (modelId: string) => {
        try {
          const status = await aiClient.getDownloadStatus(modelId);
          set((state) => ({
            downloads: {
              ...state.downloads,
              [modelId]: {
                modelId,
                status: status.status,
                progress: status.progress,
                downloadedGb: status.downloaded_gb,
                totalGb: status.total_gb,
                error: status.error,
              },
            },
          }));

          // If still in progress, schedule next poll
          if (status.status === "downloading") {
            setTimeout(() => get().pollDownloadStatus(modelId), 1500);
          }

          // If just finished, refresh the model list
          if (status.status === "ready") {
            get().fetchAvailableModels();
          }
        } catch {
          // Network error during poll - retry after longer delay
          setTimeout(() => get().pollDownloadStatus(modelId), 5000);
        }
      },

      loadModel: async (modelId: string) => {
        set({ isLoadingModel: true, loadError: null });
        try {
          await aiClient.loadModel(modelId);
          set({ loadedModelId: modelId, isLoadingModel: false });
        } catch (err) {
          set({
            isLoadingModel: false,
            loadError:
              err instanceof Error ? err.message : "Failed to load model",
          });
        }
      },

      fetchAvailableModels: async () => {
        try {
          const models = await aiClient.listModels();
          set({ availableModels: models });
        } catch {
          // Non-fatal - UI can retry
        }
      },

      syncLoadedModel: async () => {
        try {
          const { loaded, model_id } = await aiClient.getLoadedModel();
          set({ loadedModelId: loaded ? model_id : null });
        } catch {
          // Service might be starting up
        }
      },

      clearDownloadError: (modelId: string) => {
        set((state) => ({
          downloads: {
            ...state.downloads,
            [modelId]: {
              ...state.downloads[modelId],
              status: "idle",
              error: null,
            },
          },
        }));
      },
    }),

    {
      name: "openldr-model-store", // localStorage key
      // Only persist the parts that need to survive page navigation
      // Don't persist availableModels - always re-fetch from server
      partialize: (state) => ({
        loadedModelId: state.loadedModelId,
        downloads: state.downloads,
      }),
    },
  ),
);

// ── Selectors ────────────────────────────────────────────────────────────────

export const selectDownload = (modelId: string) => (state: ModelState) =>
  state.downloads[modelId] ?? {
    modelId,
    status: "idle" as DownloadStatus,
    progress: 0,
    downloadedGb: 0,
    totalGb: 0,
    error: null,
  };

export const selectIsDownloading = (state: ModelState) =>
  Object.values(state.downloads).some((d) => d.status === "downloading");

export const selectActiveDownloads = (state: ModelState) =>
  Object.values(state.downloads).filter((d) => d.status === "downloading");
