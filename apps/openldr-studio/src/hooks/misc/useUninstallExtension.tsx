import { useCallback } from "react";
import { useExtensions } from "./useExtensions";
import * as api from "@/lib/restClients/extensionRestClient";
import { useKeycloakClient } from "@/components/react-keycloak-provider";

export function useUninstallExtension() {
  const client = useKeycloakClient();
  const { dispatch, host, state } = useExtensions();
  return useCallback(
    (extId: string, thenNavigate = true) => {
      host.deactivate(extId);
      if (thenNavigate && state.activeActivity === extId) {
        dispatch({ type: "SET_ACTIVITY", payload: "extensions" });
      }
      if (client.authenticated) {
        api
          .uninstallExtension(client.kc.token, extId)
          .catch((err) =>
            console.warn(
              `[Uninstall] Failed to persist uninstall for ${extId}:`,
              err.message,
            ),
          );
      }
    },
    [host, dispatch, api],
  );
}
