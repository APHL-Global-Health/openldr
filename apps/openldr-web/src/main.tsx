import React from "react";
import Keycloak from "@/lib/keycloak";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "@/styles/index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import NotFoundPage from "./pages/NotFoundPage";
import LandingPage from "./pages/LandingPage";
import {
  OpenLDRClient,
  OpenLDRClientProvider,
} from "@/components/openldr-client-provider";
import {
  KeycloakClient,
  ReactKeycloakProvider,
} from "@/components/react-keycloak-provider";
import { Toaster } from "@/components/ui/sonner";
import DashboardPage from "@/pages/DashboardPage";
import ArchivePage from "@/pages/ArchivePage";
import ExtensionsPage from "@/pages/ExtensionsPage";
import DataEntryPage from "@/pages/DataEntry";
import ExtensionPage from "@/pages/ExtensionPage";
import SettingsPage from "@/pages/settings/page";
import OCLPage from "@/pages/OCLPage";

import { sdk } from "@/lib/sdk";
import DocsPage from "./pages/DocsPage";

import {
  SQLiteClient,
  SQLiteClientProvider,
} from "@/components/sqlite-client-provider.tsx";

const sqliteClient = new SQLiteClient();
const keycloakClient = new KeycloakClient(Keycloak);

// Make SDK available globally BEFORE loading any extensions
(window as any).__OPENLDR_SDK__ = sdk(keycloakClient);

const queryClient = new QueryClient();
const openLDRClient = new OpenLDRClient();

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const ENV = import.meta.env;
const baseUrl = ENV.VITE_BASE_URL || "/";

const router = createBrowserRouter([
  {
    path: baseUrl,
    element: <LandingPage />,
    children: [
      { path: baseUrl, element: <DashboardPage /> },
      { path: `${baseUrl}data-entry`, element: <DataEntryPage /> },
      { path: `${baseUrl}archive`, element: <ArchivePage /> },

      //TODO Improve later
      /*{ path: `${baseUrl}ocl`, element: <OCLPage /> },
      { path: `${baseUrl}ocl/:route`, element: <OCLPage /> },
      { path: `${baseUrl}ocl/:route/:org`, element: <OCLPage /> },
      { path: `${baseUrl}ocl/:route/:org/sources`, element: <OCLPage /> },
      {
        path: `${baseUrl}ocl/:route/:org/sources/:source`,
        element: <OCLPage />,
      },
      {
        path: `${baseUrl}ocl/:route/:org/sources/:source/concepts`,
        element: <OCLPage />,
      },
      {
        path: `${baseUrl}ocl/:route/:org/sources/:source/concepts/:concept`,
        element: <OCLPage />,
      },*/

      { path: `${baseUrl}extension/:route`, element: <ExtensionPage /> },
      { path: `${baseUrl}extensions`, element: <ExtensionsPage /> },

      { path: `${baseUrl}docs`, element: <DocsPage /> },
      { path: `${baseUrl}settings`, element: <SettingsPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

root.render(
  <React.StrictMode>
    <SQLiteClientProvider client={sqliteClient}>
      <ReactKeycloakProvider client={keycloakClient}>
        <OpenLDRClientProvider client={openLDRClient}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            {import.meta.env.MODE === "development" && (
              <ReactQueryDevtools initialIsOpen={false} />
            )}
          </QueryClientProvider>
        </OpenLDRClientProvider>
      </ReactKeycloakProvider>
    </SQLiteClientProvider>

    <Toaster
      richColors
      expand={false}
      position="bottom-center"
      className="z-100! pointer-events-auto"
    />
  </React.StrictMode>
);
