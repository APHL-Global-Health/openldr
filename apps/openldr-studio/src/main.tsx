import Keycloak from "@/lib/keycloak";
import React from "react";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import "@/styles/index.css";

const LandingPage = React.lazy(() => import("@/pages/LandingPage"));
const NotFoundPage = React.lazy(() => import("@/pages/NotFoundPage"));
const DashboardPage = React.lazy(() => import("@/pages/DashboardPage"));
const ArchivePage = React.lazy(() => import("@/pages/ArchivePage"));
const ExtensionsPage = React.lazy(() => import("@/pages/ExtensionsPage"));
const DataEntryPage = React.lazy(() => import("@/pages/DataEntry"));
const ExtensionPage = React.lazy(() => import("@/pages/ExtensionPage"));
const SettingsPage = React.lazy(() => import("@/pages/settings/page"));
const ReportsPage = React.lazy(() => import("@/pages/ReportsPage"));
const ChatPage = React.lazy(() => import("@/pages/ChatPage"));
const LogsPage = React.lazy(() => import("@/pages/LogsPage"));

import { Toaster } from "@/components/ui/sonner";
import {
  SQLiteClient,
  SQLiteClientProvider,
} from "@/components/sqlite-client-provider.tsx";
import {
  KeycloakClient,
  ReactKeycloakProvider,
} from "@/components/react-keycloak-provider";

import { sdk } from "@/lib/sdk";

const queryClient = new QueryClient();
const sqliteClient = new SQLiteClient();
const keycloakClient = new KeycloakClient(Keycloak);

// Make SDK available globally BEFORE loading any extensions
(window as any).__OPENLDR_SDK__ = sdk(keycloakClient);

const ENV = import.meta.env;
const baseUrl = ENV.VITE_BASE_URL || "/";

const router = createBrowserRouter([
  {
    path: baseUrl,
    element: <LandingPage />,
    children: [
      { path: baseUrl, element: <DashboardPage /> },
      { path: `${baseUrl}data-entry`, element: <DataEntryPage /> },
      { path: `${baseUrl}archives`, element: <ArchivePage /> },
      { path: `${baseUrl}extension/:extId`, element: <ExtensionPage /> },
      { path: `${baseUrl}extensions`, element: <ExtensionsPage /> },
      { path: `${baseUrl}reports`, element: <ReportsPage /> },
      { path: `${baseUrl}chats`, element: <ChatPage /> },
      { path: `${baseUrl}logs`, element: <LogsPage /> },
      { path: `${baseUrl}settings`, element: <SettingsPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SQLiteClientProvider client={sqliteClient}>
      <ReactKeycloakProvider client={keycloakClient}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          {import.meta.env.MODE === "development" && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </ReactKeycloakProvider>
    </SQLiteClientProvider>

    <Toaster
      richColors
      expand={false}
      position="bottom-center"
      className="z-100! pointer-events-auto"
    />
  </StrictMode>,
);
