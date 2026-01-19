// hooks/useExtensions.ts
import { useState, useEffect, useCallback } from "react";
import * as exts from "@openldr/extensions";
import { extensionEvents } from "@/lib/extensionEvents";

const ENV = import.meta.env;
const API_BASE = `${ENV.VITE_API_BASE_URL}/api/v1/openldr/extensions`;
const IsDev = ENV.MODE === "development";

export function useExtensions(token: string | undefined) {
  const [extensions, setExtensions] = useState<exts.types.ExtensionBase[]>([]);
  const [components, setComponents] = useState<any>(null);
  const [userExtensions, setUserExtensions] = useState<
    exts.types.ExtensionUser[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all available extensions from marketplace
  const fetchExtensions = useCallback(
    async (
      filters?: {
        search?: string;
        category?: string;
        tag?: string;
        sort?: "downloads" | "rating" | "recent" | "name";
      },
      signal?: AbortSignal
    ) => {
      if (!token) return;

      try {
        const params = new URLSearchParams();
        if (filters?.search) params.append("search", filters.search);
        if (filters?.category) params.append("category", filters.category);
        if (filters?.tag) params.append("tag", filters.tag);
        if (filters?.sort) params.append("sort", filters.sort);

        const response = await fetch(`${API_BASE}?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch extensions: ${response.statusText}`);
        }

        const data = await response.json();
        setExtensions(data);
        return data;
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Failed to fetch extensions:", err);
          setError(err.message);
        }
        throw err;
      }
    },
    [token]
  );

  // Get detailed extension info
  const getExtension = useCallback(
    async (
      packageId: string,
      signal?: AbortSignal
    ): Promise<exts.types.ExtensionBase> => {
      if (!token) throw new Error("No token provided");

      const response = await fetch(`${API_BASE}/${packageId}/info`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch extension: ${response.statusText}`);
      }

      return response.json();
    },
    [token]
  );

  // Get all versions for an extension
  const getExtensionVersions = useCallback(
    async (
      packageId: string,
      signal?: AbortSignal
    ): Promise<exts.types.ExtensionVersion[]> => {
      if (!token) throw new Error("No token provided");

      const response = await fetch(`${API_BASE}/${packageId}/versions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch versions: ${response.statusText}`);
      }

      return response.json();
    },
    [token]
  );

  // Get specific version details
  const getExtensionVersion = useCallback(
    async (
      packageId: string,
      version: string,
      signal?: AbortSignal
    ): Promise<exts.types.ExtensionVersion> => {
      if (!token) throw new Error("No token provided");

      const response = await fetch(
        `${API_BASE}/${packageId}/versions/${version}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch version: ${response.statusText}`);
      }

      return response.json();
    },
    [token]
  );

  // Check for updates
  const checkForUpdates = useCallback(
    async (
      packageId: string,
      currentVersion: string,
      appVersion: string,
      signal?: AbortSignal
    ) => {
      if (!token) throw new Error("No token provided");

      const params = new URLSearchParams({
        currentVersion,
        appVersion,
      });

      const response = await fetch(
        `${API_BASE}/${packageId}/check-updates?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to check updates: ${response.statusText}`);
      }

      return response.json();
    },
    [token]
  );

  // Download extension code
  const downloadExtensionCode = useCallback(
    async (versionId: string, signal?: AbortSignal) => {
      if (!token) throw new Error("No token provided");

      const response = await fetch(
        `${API_BASE}/version/${versionId}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download extension: ${response.statusText}`);
      }

      return response.json();
    },
    [token]
  );

  // Get version permissions
  const getVersionPermissions = useCallback(
    async (
      versionId: string,
      signal?: AbortSignal
    ): Promise<exts.types.ExtensionPermission[]> => {
      if (!token) throw new Error("No token provided");

      const response = await fetch(
        `${API_BASE}/version/${versionId}/permissions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch permissions: ${response.statusText}`);
      }

      return response.json();
    },
    [token]
  );

  // Load user's installed extensions
  const loadUserExtensions = useCallback(
    async (
      status?: "installed" | "enabled" | "disabled" | "all",
      signal?: AbortSignal
    ) => {
      if (!token) return;

      try {
        const params = new URLSearchParams();
        if (status) params.append("status", status);

        const response = await fetch(
          `${API_BASE}/user/installed?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch user extensions: ${response.statusText}`
          );
        }

        const extensions = await response.json();
        setUserExtensions(extensions);

        // Auto-load enabled extensions
        for (const userExt of extensions) {
          if (userExt.status === "enabled" && userExt.version) {
            try {
              const { code, manifest } = await downloadExtensionCode(
                userExt.versionId,
                signal
              );

              await exts.runtime.extensionLoader.extensionLoader.loadExtension(
                manifest,
                code
              );
            } catch (err) {
              if (err instanceof Error && err.name !== "AbortError") {
                console.error(
                  `Failed to auto-load extension ${userExt.extensionId}:`,
                  err
                );
              }
            }
          }
        }

        return extensions;
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          const message = err.message || "Failed to load extensions";
          setError(message);
          console.error("Failed to load user extensions:", err);
        }
        throw err;
      }
    },
    [token, downloadExtensionCode]
  );

  // Install extension
  const install = useCallback(
    async (extensionId: string, versionId: string, signal?: AbortSignal) => {
      if (!token) throw new Error("No token provided");

      try {
        // First, get permissions to show to user
        const permissions = await getVersionPermissions(versionId, signal);

        // TODO: Show permission confirmation dialog to user here
        // For now, we'll auto-accept

        const response = await fetch(`${API_BASE}/${extensionId}/install`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ versionId }),
          signal,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to install extension");
        }

        const result = await response.json();
        const userExt = result.userExtension;

        // Download and load the extension code
        const { code, manifest } = await downloadExtensionCode(
          versionId,
          signal
        );
        await exts.runtime.extensionLoader.extensionLoader.loadExtension(
          manifest,
          code
        );

        // Update local state
        setUserExtensions((prev) => {
          const filtered = prev.filter(
            (ext) => ext.extensionId !== extensionId
          );
          return [...filtered, userExt];
        });

        // Emit event to notify other components
        extensionEvents.emit("extension:installed", extensionId);

        return { userExtension: userExt, permissions };
      } catch (err) {
        console.error("Failed to install extension:", err);
        throw err;
      }
    },
    [token, getVersionPermissions, downloadExtensionCode]
  );

  // Enable extension
  const enable = useCallback(
    async (extensionId: string, signal?: AbortSignal) => {
      if (!token) throw new Error("No token provided");

      try {
        const response = await fetch(`${API_BASE}/${extensionId}/enable`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        });

        if (!response.ok) {
          throw new Error("Failed to enable extension");
        }

        const userExt = await response.json();

        // Load the extension code
        const { code, manifest } = await downloadExtensionCode(
          userExt.versionId,
          signal
        );
        await exts.runtime.extensionLoader.extensionLoader.loadExtension(
          manifest,
          code
        );

        // Update local state
        setUserExtensions((prev) =>
          prev.map((ext) => (ext.extensionId === extensionId ? userExt : ext))
        );

        // Emit event
        extensionEvents.emit("extension:enabled", extensionId);

        return userExt;
      } catch (err) {
        console.error("Failed to enable extension:", err);
        throw err;
      }
    },
    [token, downloadExtensionCode]
  );

  // Disable extension
  const disable = useCallback(
    async (extensionId: string, signal?: AbortSignal) => {
      if (!token) throw new Error("No token provided");

      try {
        const response = await fetch(`${API_BASE}/${extensionId}/disable`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        });

        if (!response.ok) {
          throw new Error("Failed to disable extension");
        }

        const userExt = await response.json();

        // Unload the extension
        await exts.runtime.extensionLoader.extensionLoader.unloadExtension(
          extensionId
        );

        // Update local state
        setUserExtensions((prev) =>
          prev.map((ext) => (ext.extensionId === extensionId ? userExt : ext))
        );

        // Emit event
        extensionEvents.emit("extension:disabled", extensionId);

        return userExt;
      } catch (err) {
        console.error("Failed to disable extension:", err);
        throw err;
      }
    },
    [token]
  );

  // Uninstall extension
  const uninstall = useCallback(
    async (extensionId: string, signal?: AbortSignal) => {
      if (!token) throw new Error("No token provided");

      try {
        const response = await fetch(`${API_BASE}/${extensionId}/uninstall`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        });

        if (!response.ok) {
          throw new Error("Failed to uninstall extension");
        }

        // Unload the extension
        await exts.runtime.extensionLoader.extensionLoader.unloadExtension(
          extensionId
        );

        // Update local state (remove from list)
        setUserExtensions((prev) =>
          prev.filter((ext) => ext.extensionId !== extensionId)
        );

        // Emit event
        extensionEvents.emit("extension:uninstalled", extensionId);
      } catch (err) {
        console.error("Failed to uninstall extension:", err);
        throw err;
      }
    },
    [token]
  );

  // Update extension to new version
  const update = useCallback(
    async (extensionId: string, versionId: string, signal?: AbortSignal) => {
      if (!token) throw new Error("No token provided");

      try {
        // Unload current version
        await exts.sdk.extensionLoader.unloadExtension(extensionId);

        const response = await fetch(`${API_BASE}/${extensionId}/update`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ versionId }),
          signal,
        });

        if (!response.ok) {
          throw new Error("Failed to update extension");
        }

        const userExt = await response.json();

        // Download and load new version
        const { code, manifest } = await downloadExtensionCode(
          versionId,
          signal
        );
        await exts.sdk.extensionLoader.loadExtension(manifest, code);

        // Update local state
        setUserExtensions((prev) =>
          prev.map((ext) => (ext.extensionId === extensionId ? userExt : ext))
        );

        // Emit event
        extensionEvents.emit("extension:updated", extensionId);

        return userExt;
      } catch (err) {
        console.error("Failed to update extension:", err);
        // Try to reload the old version if update fails
        const oldExt = userExtensions.find(
          (e) => e.extensionId === extensionId
        );
        if (oldExt) {
          try {
            const { code, manifest } = await downloadExtensionCode(
              oldExt.versionId,
              signal
            );
            await exts.sdk.extensionLoader.loadExtension(manifest, code);
          } catch (reloadErr) {
            console.error("Failed to reload old version:", reloadErr);
          }
        }
        throw err;
      }
    },
    [token, downloadExtensionCode, userExtensions]
  );

  // Update extension settings
  const updateSettings = useCallback(
    async (
      extensionId: string,
      settings: Record<string, any>,
      signal?: AbortSignal
    ) => {
      if (!token) throw new Error("No token provided");

      try {
        const response = await fetch(`${API_BASE}/${extensionId}/settings`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ settings }),
          signal,
        });

        if (!response.ok) {
          throw new Error("Failed to update settings");
        }

        const userExt = await response.json();

        // Update local state
        setUserExtensions((prev) =>
          prev.map((ext) => (ext.extensionId === extensionId ? userExt : ext))
        );

        return userExt;
      } catch (err) {
        console.error("Failed to update settings:", err);
        throw err;
      }
    },
    [token]
  );

  // Toggle auto-update
  const toggleAutoUpdate = useCallback(
    async (extensionId: string, autoUpdate: boolean, signal?: AbortSignal) => {
      if (!token) throw new Error("No token provided");

      try {
        const response = await fetch(`${API_BASE}/${extensionId}/auto-update`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ autoUpdate }),
          signal,
        });

        if (!response.ok) {
          throw new Error("Failed to update auto-update setting");
        }

        const userExt = await response.json();

        // Update local state
        setUserExtensions((prev) =>
          prev.map((ext) => (ext.extensionId === extensionId ? userExt : ext))
        );

        return userExt;
      } catch (err) {
        console.error("Failed to toggle auto-update:", err);
        throw err;
      }
    },
    [token]
  );

  // Publish new extension version
  const publishVersion = useCallback(
    async (
      file: File | Blob,
      manifest: any,
      options?: {
        changelog?: string;
        breaking?: boolean;
      },
      signal?: AbortSignal
    ) => {
      if (!token) throw new Error("No token provided");

      try {
        const formData = new FormData();
        formData.append(
          "package",
          file,
          file instanceof File ? file.name : "package.zip"
        );
        formData.append("manifest", JSON.stringify(manifest));

        if (options?.changelog) {
          formData.append("changelog", options.changelog);
        }

        if (options?.breaking) {
          formData.append("breaking", "true");
        }

        const response = await fetch(`${API_BASE}/${manifest.id}/versions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error ${response.status}: ${response.statusText}${
              IsDev ? ` - ${errorText}` : ""
            }`
          );
        }

        return await response.json();
      } catch (err) {
        console.error("Failed to publish extension:", err);
        throw err;
      }
    },
    [token]
  );

  // Submit review
  const submitReview = useCallback(
    async (
      extensionId: string,
      rating: number,
      comment?: string,
      signal?: AbortSignal
    ) => {
      if (!token) throw new Error("No token provided");

      try {
        const response = await fetch(`${API_BASE}/${extensionId}/review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rating, comment }),
          signal,
        });

        if (!response.ok) {
          throw new Error("Failed to submit review");
        }

        return await response.json();
      } catch (err) {
        console.error("Failed to submit review:", err);
        throw err;
      }
    },
    [token]
  );

  // Get reviews for extension
  const getReviews = useCallback(
    async (
      extensionId: string,
      options?: {
        limit?: number;
        offset?: number;
        sort?: "recent" | "rating";
      },
      signal?: AbortSignal
    ) => {
      if (!token) throw new Error("No token provided");

      const params = new URLSearchParams();
      if (options?.limit) params.append("limit", options.limit.toString());
      if (options?.offset) params.append("offset", options.offset.toString());
      if (options?.sort) params.append("sort", options.sort);

      const response = await fetch(
        `${API_BASE}/${extensionId}/reviews?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch reviews");
      }

      return await response.json();
    },
    [token]
  );

  // Refresh all data
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;

      try {
        setLoading(true);
        setError(null);
        await Promise.all([
          fetchExtensions(undefined, signal),
          loadUserExtensions("enabled", signal),
        ]);

        const components = exts.sdk.api.ui.getComponents();
        setComponents(components);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Failed to refresh:", err);
        }
      } finally {
        setLoading(false);
      }
    },
    [token, fetchExtensions, loadUserExtensions]
  );

  // Initial load
  useEffect(() => {
    if (!token) return;
    const abortController = new AbortController();

    const unsubscribe = extensionEvents.subscribe((detail) => {
      // console.log("Extension event received:", detail);
      // Optionally refresh specific extension or entire list
      refresh(abortController.signal);
    });

    refresh(abortController.signal);
    return () => {
      abortController.abort();
      // unsubscribe;
    };
  }, [token, refresh]);

  // Check if extension is installed
  const isInstalled = useCallback(
    (extensionId: string) => {
      return userExtensions.some(
        (ext) => ext.extensionId === extensionId && ext.status !== "uninstalled"
      );
    },
    [userExtensions]
  );

  // Get user extension by id
  const getUserExtension = useCallback(
    (extensionId: string) => {
      return userExtensions.find((ext) => ext.extensionId === extensionId);
    },
    [userExtensions]
  );

  return {
    // State
    extensions,
    userExtensions,
    loading,
    error,
    components,

    // Marketplace operations
    fetchExtensions,
    getExtension,
    getExtensionVersions,
    getExtensionVersion,
    checkForUpdates,
    downloadExtensionCode,
    getVersionPermissions,

    // User operations
    loadUserExtensions,
    install,
    enable,
    disable,
    uninstall,
    update,
    updateSettings,
    toggleAutoUpdate,

    // Publishing
    publishVersion,

    // Reviews
    submitReview,
    getReviews,

    // Utilities
    refresh,
    isInstalled,
    getUserExtension,
  };
}
