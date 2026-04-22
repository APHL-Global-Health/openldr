import { useEffect } from "react";
import { useModelStore } from "@/store/model-store";

/**
 * Resume polling for any downloads that were in-progress when the user
 * navigated away. Call this once at the app root (e.g. in App.tsx or layout).
 *
 * Key fix: reads store state via getState() inside the effect instead of
 * subscribing via useModelStore() - avoids the infinite re-render loop caused
 * by pollDownloadStatus calling setState which triggers re-subscription.
 */
export function useResumeDownloadPolling() {
  useEffect(() => {
    // Read state once at mount time - no subscription, no re-render loop
    const { downloads, syncLoadedModel, pollDownloadStatus } =
      useModelStore.getState();

    // Sync loaded model from backend on startup
    syncLoadedModel();

    // Resume polling for any downloads that were mid-flight when user navigated
    for (const download of Object.values(downloads)) {
      if (download.status === "downloading") {
        pollDownloadStatus(download.modelId);
      }
    }
  }, []); // empty deps - truly runs once on mount only
}

/**
 * Hook for the chat/model settings page.
 * Fetches available models and resumes any in-progress downloads on mount.
 */
export function useModelPageInit() {
  useEffect(() => {
    const {
      downloads,
      fetchAvailableModels,
      syncLoadedModel,
      pollDownloadStatus,
    } = useModelStore.getState();

    fetchAvailableModels();
    syncLoadedModel();

    for (const download of Object.values(downloads)) {
      if (download.status === "downloading") {
        pollDownloadStatus(download.modelId);
      }
    }
  }, []);
}
