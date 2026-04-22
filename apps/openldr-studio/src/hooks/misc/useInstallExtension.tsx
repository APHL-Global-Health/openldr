import { type ExtensionState } from "@/types/extensions";
import { useExtensions } from "./useExtensions";
import { useCallback } from "react";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import * as api from "@/lib/restClients/extensionRestClient";
import { injectBridge } from "@/lib/extensions";

const ENV = import.meta.env;

export function useInstallExtension() {
  const client = useKeycloakClient();
  const { dispatch, host, loader, state } = useExtensions();
  return useCallback(
    async (
      ext: ExtensionState,
      onSuccess?: () => void,
      skipPrompt = false, // true when restoring from server (already approved)
    ) => {
      if (ext.state === "fetching" || ext.state === "activating") return;
      dispatch({
        type: "EXT_STATE",
        payload: { extId: ext.id, state: "fetching" },
      });
      try {
        const codeResp = await loader.fetchAndVerifyPayload(ext);

        let approvedPermissions: string[] = ext.permissions;

        if (!skipPrompt) {
          approvedPermissions = await new Promise<string[]>(
            (resolve, reject) => {
              dispatch({
                type: "SET_PERMISSION_PROMPT",
                payload: {
                  extId: ext.id,
                  permissions: ext.permissions,
                  resolve: () => resolve(ext.permissions),
                  reject,
                },
              });
            },
          );
        }

        if (ext.kind === "worker") {
          await host.loadWorkerExtension(ext, codeResp.payload);
        } else {
          const htmlWithBridge = injectBridge(
            codeResp.payload,
            ext.id,
            ENV.VITE_API_BASE_URL,
            client.kc.token ?? "",
          );
          dispatch({
            type: "EXT_STATE",
            payload: { extId: ext.id, payload: htmlWithBridge },
          });
          host.loadIframeExtension(ext);
        }

        // Persist to server (no-op if unauthenticated)
        if (client.authenticated) {
          api
            .installExtension(client.kc.token, ext.id, approvedPermissions)
            .catch((err) =>
              console.warn(
                `[Install] Failed to persist ${ext.id}:`,
                err.message,
              ),
            );
        }

        onSuccess?.();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : undefined;
        if (!msg) {
          dispatch({
            type: "EXT_STATE",
            payload: { extId: ext.id, state: "inactive" },
          });
        } else {
          dispatch({
            type: "EXT_STATE",
            payload: { extId: ext.id, state: "error", error: msg },
          });
          dispatch({
            type: "ADD_NOTIFICATION",
            payload: {
              message: `Failed: "${ext.name}": ${msg}`,
              kind: "error",
              extId: ext.id,
            },
          });
        }
      }
    },
    [host, loader, dispatch],
  );
}
