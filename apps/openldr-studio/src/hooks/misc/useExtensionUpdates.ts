import { useState, useEffect } from "react";

const API_BASE = `${process.env.VITE_API_BASE_URL}/api/v1/openldr/extensions`;
const APP_VERSION = "1.0.0"; // Your app version

export function useExtensionUpdates() {
  const [updates, setUpdates] = useState<Record<string, any>>({});
  const [checking, setChecking] = useState(false);

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const installedExtensions = JSON.parse(
        localStorage.getItem("extension-versions") || "{}"
      );

      const updatePromises = Object.entries(installedExtensions).map(
        async ([extensionId, currentVersion]) => {
          const response = await fetch(
            `${API_BASE}/${extensionId}/check-updates?currentVersion=${currentVersion}&appVersion=${APP_VERSION}`
          );
          const data = await response.json();
          return { extensionId, data };
        }
      );

      const results = await Promise.all(updatePromises);
      const availableUpdates: Record<string, any> = {};

      results.forEach(({ extensionId, data }) => {
        if (data.updateAvailable) {
          availableUpdates[extensionId] = data.latestVersion;
        }
      });

      setUpdates(availableUpdates);
    } catch (error) {
      console.error("Failed to check for updates:", error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkForUpdates();

    // Check for updates every hour
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    updates,
    checking,
    checkForUpdates,
    hasUpdates: Object.keys(updates).length > 0,
  };
}
