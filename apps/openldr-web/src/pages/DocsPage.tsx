import LogoutOptions from "@/components/logout-options";
import { useSideBarContext } from "@/components/sidebar-provider";
import { Separator } from "@/components/ui/separator";
import useWindowSize from "@/hooks/misc/useWindowSize";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useQuery } from "@tanstack/react-query";

import * as APIDocRestClient from "@/lib/restClients/apiDocsRestClient";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { LoadingSpinner } from "@/components/loading-spinner";
import { LanguageSwitcher } from "@/components/language-switcher";

const getCurrentTheme = () => {
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
};

function DocsPage() {
  const windowSize = useWindowSize();
  const client = useKeycloakClient();
  const sideBarContext = useSideBarContext();
  const isCollapsed = sideBarContext?.isCollapsed ?? false;

  const theme = localStorage.getItem("theme") || getCurrentTheme();

  const {
    data: doc,
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: ["Doc", "API"],
    queryFn: async () => {
      return await APIDocRestClient.getDoc("yaml", client.kc.token);
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  return (
    <div className="flex w-full h-full flex-col">
      <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2">
        <div className="flex flex-1"></div>
        <Separator orientation="vertical" className="mx-2 h-6" />
        <LanguageSwitcher />
        <Separator orientation="vertical" className="mx-2 h-6" />
        <LogoutOptions />
      </div>
      <Separator />
      <div className="flex w-full h-full flex-col overflow-y-auto overflow-x-hidden">
        <div
          style={{
            maxWidth: `${windowSize.width - (isCollapsed ? 48 : 196)}px`,
            maxHeight: `${windowSize.height - 53}px`,
          }}
        >
          {isLoading || isRefetching ? (
            <div
              className="flex flex-1 w-full h-full items-center justify-center"
              style={{
                minWidth: `${windowSize.width - (isCollapsed ? 48 : 196)}px`,
                maxWidth: `${windowSize.width - (isCollapsed ? 48 : 196)}px`,
                minHeight: `${windowSize.height - 53}px`,
                maxHeight: `${windowSize.height - 53}px`,
              }}
            >
              <LoadingSpinner />
            </div>
          ) : (
            <ApiReferenceReact
              configuration={{
                // url: "https://cdn.jsdelivr.net/npm/@scalar/galaxy/dist/latest.yaml",
                // url: "documentation/latest.yaml",
                content: doc,
                darkMode: theme === "dark",
                forceDarkModeState: theme === "dark" ? "dark" : "light",
                hideClientButton: true,
                hideDarkModeToggle: true,
                showDeveloperTools: "never",
                hiddenClients: true,
                hideTestRequestButton: true,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default DocsPage;
