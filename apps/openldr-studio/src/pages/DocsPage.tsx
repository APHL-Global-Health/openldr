import { ContentLayout } from "@/components/admin-panel/content-layout";
import { cn } from "@/lib/utils";

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
  const client = useKeycloakClient();
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

  const navComponents = () => {
    return <h1 className="font-bold">Docs</h1>;
  };

  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <div className="flex w-full h-full flex-col overflow-auto min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]">
          {isLoading || isRefetching ? (
            <div className="flex min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]  w-full h-full items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <ApiReferenceReact
              configuration={{
                url: "https://cdn.jsdelivr.net/npm/@scalar/galaxy/dist/latest.yaml",
                // url: "documentation/latest.yaml",
                // content: doc,
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
    </ContentLayout>
  );
}

export default DocsPage;
