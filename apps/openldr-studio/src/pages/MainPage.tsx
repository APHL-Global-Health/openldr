import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Outlet } from "react-router-dom";
import { DownloadStatusBanner } from "@/components/chat/chat-download-status-banner";
import { useEffect, useReducer, useRef, useState } from "react";

import {
  type AppState,
  // type AuthState,
  type ExtensionState,
  ExtensionLoader,
  ExtensionHost,
  type LoaderConfig,
} from "@/types/extensions";

import { CommandPalette } from "@/components/extensions/command-palette";
import { NotificationStack } from "@/components/extensions/notifications";
import { PermissionPromptDialog } from "@/components/extensions/permission-dialog";

import { ExtCtx } from "@/hooks/misc/useExtensions";

import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { types } from "@openldr/extensions";

import * as api from "@/lib/restClients/extensionRestClient";
import { injectBridge } from "@/lib/extensions";

const ENV = import.meta.env;
const DEFAULT_API_BASE =
  typeof window !== "undefined"
    ? ENV.VITE_API_BASE_URL || "http://localhost:4000"
    : "http://localhost:4000";
// const IsDev = ENV.MODE === "development";
// const DEFAULT_CONFIG: LoaderConfig = { baseUrl: ENV.VITE_API_BASE_URL };
// const DEFAULT_CONFIG: LoaderConfig = { baseUrl: "http://localhost:4000" };

export const initialState: AppState = {
  extensions: [],
  commands: [],
  notifications: [],
  statusBar: [],
  logs: [],
  commandPaletteOpen: false,
  activeTab: "main",
  activeSecondaryTab: "secondary",
  devConsoleOpen: false,
  appEvents: [],
  apiConfigOpen: false,
  permissionPrompt: null,
  activeActivity: null,
  selectedExtId: null,
  apiBase: DEFAULT_API_BASE,
};

function reducer(
  state: AppState,
  action: { type: string; payload?: unknown },
): AppState {
  switch (action.type) {
    case "REGISTRY_LOADED":
      return {
        ...state,
        extensions: (action.payload as types.ExtensionManifest[]).map((m) => ({
          ...m,
          state: "inactive",
          error: null,
          enabled: false,
        })),
      };
    case "EXT_STATE":
      return {
        ...state,
        extensions: state.extensions.map((e) =>
          e.id === (action.payload as { extId: string }).extId
            ? { ...e, ...(action.payload as Partial<ExtensionState>) }
            : e,
        ),
      };
    case "COMMANDS_UPDATE":
      return { ...state, commands: action.payload as AppState["commands"] };
    case "STATUS_BAR_UPDATE":
      return { ...state, statusBar: action.payload as AppState["statusBar"] };
    case "ADD_NOTIFICATION": {
      const n = {
        ...(action.payload as object),
        id: Date.now() + Math.random(),
        ts: new Date().toLocaleTimeString(),
      } as AppState["notifications"][0];
      return {
        ...state,
        notifications: [n, ...state.notifications].slice(0, 5),
      };
    }
    case "DISMISS_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter(
          (n) => n.id !== action.payload,
        ),
      };
    case "EXT_LOG": {
      const log = {
        ...(action.payload as object),
        id: Date.now() + Math.random(),
        ts: performance.now().toFixed(1),
      } as AppState["logs"][0];
      return { ...state, logs: [log, ...state.logs].slice(0, 200) };
    }
    case "APP_EVENT":
      return {
        ...state,
        appEvents: [
          action.payload as { event: string; payload: unknown },
          ...state.appEvents,
        ].slice(0, 50),
      };
    case "TOGGLE_PALETTE":
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen };
    case "CLOSE_PALETTE":
      return { ...state, commandPaletteOpen: false };
    case "TOGGLE_DEV":
      return { ...state, devConsoleOpen: !state.devConsoleOpen };
    case "SET_PERMISSION_PROMPT":
      return {
        ...state,
        permissionPrompt: action.payload as AppState["permissionPrompt"],
      };
    case "SET_ACTIVITY":
      return { ...state, activeActivity: action.payload as string };
    case "SELECT_EXT":
      return { ...state, selectedExtId: action.payload as string | null };
    // case "SET_AUTH":
    //   return { ...state, auth: action.payload as AuthState };
    case "DEACTIVATE_ALL":
      return {
        ...state,
        extensions: state.extensions.map((e) =>
          e.state === "active"
            ? { ...e, state: "inactive" as const, payload: undefined }
            : e,
        ),
      };
    default:
      return state;
  }
}

function App() {
  const config: LoaderConfig = { baseUrl: ENV.VITE_API_BASE_URL };

  const [state, dispatch] = useReducer(reducer, initialState);
  const hostRef = useRef<ExtensionHost | null>(null);
  const loaderRef = useRef(new ExtensionLoader(config));

  const [apiStatus, setApiStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

  const client = useKeycloakClient();

  if (!hostRef.current)
    hostRef.current = new ExtensionHost(
      dispatch,
      DEFAULT_API_BASE,
      () => client.kc.token!,
    );
  const host = hostRef.current;
  const loader = loaderRef.current;

  // ── Auto-start user's extensions after login ────────────────────────
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (
      state.extensions.length === 0 || // wait for registry
      autoStartedRef.current
    )
      return;

    autoStartedRef.current = true;

    api
      .getUserExtensions(client.kc.token)
      .then((installs) => {
        if (installs.length === 0) return;

        // dispatch({
        //   type: "ADD_NOTIFICATION",
        //   payload: {
        //     message: `Restoring ${installs.length} extension${installs.length > 1 ? "s" : ""}…`,
        //     kind: "info",
        //     extId: "host",
        //   },
        // });

        for (const install of installs) {
          const ext = state.extensions.find(
            (e) => e.id === install.extensionId,
          );
          if (!ext) continue;

          // Inject the manifest as an ExtensionState to pass to the install hook
          const extState: ExtensionState = {
            ...ext,
            state: "inactive",
            error: null,
            enabled: true,
          };

          const autoLoad = async () => {
            dispatch({
              type: "EXT_STATE",
              payload: { extId: ext.id, state: "fetching" },
            });
            try {
              const codeResp = await loader.fetchAndVerifyPayload(extState);
              if (ext.kind === "worker") {
                await host.loadWorkerExtension(extState, codeResp.payload);
              } else {
                const html = injectBridge(
                  codeResp.payload,
                  ext.id,
                  config.baseUrl,
                  client.kc.token!,
                );
                dispatch({
                  type: "EXT_STATE",
                  payload: { extId: ext.id, payload: html },
                });
                host.loadIframeExtension(extState);
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              dispatch({
                type: "EXT_STATE",
                payload: { extId: ext.id, state: "error", error: msg },
              });
            }
          };

          autoLoad();
        }
      })
      .catch((err) => {
        console.warn("[App] Failed to fetch user extensions:", err.message);
      });
  }, [state.extensions.length]);

  useEffect(() => {
    if (client.user) {
      setApiStatus("connecting");
      loader.updateConfig({
        ...config,
        token: client.kc.token,
      });
      loader
        .fetchRegistry()
        .then((reg) => {
          dispatch({ type: "REGISTRY_LOADED", payload: reg.extensions });
          setApiStatus("connected");
        })
        .catch((err) => {
          setApiStatus("error");
          dispatch({
            type: "ADD_NOTIFICATION",
            payload: {
              message: `Registry unreachable at ${config.baseUrl}: ${err.message}`,
              kind: "error",
              extId: "host",
            },
          });
        });
    }

    return () => host.destroy();
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <ExtCtx.Provider value={{ state, dispatch, host, loader }}>
        <AdminPanelLayout state={state} apiStatus={apiStatus}>
          <Outlet />
          <DownloadStatusBanner /> {/* floats bottom-right corner */}
        </AdminPanelLayout>

        {/* global overlays */}
        <CommandPalette />
        <NotificationStack />
        <PermissionPromptDialog />
        {/* <ApiConfigDialog
          open={apiConfigOpen}
          config={apiConfig}
          onSave={c => { setApiConfig(c); loader.updateConfig(c) }}
          onClose={() => setApiConfigOpen(false)}
        /> */}
      </ExtCtx.Provider>
    </TooltipProvider>
  );
}

export default App;
