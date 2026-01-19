import LogoutOptions from "@/components/logout-options";
import { Separator } from "@/components/ui/separator";
import useWindowSize from "@/hooks/misc/useWindowSize";
import { useSideBarContext } from "@/components/sidebar-provider";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import * as exts from "@openldr/extensions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExtensions } from "@/hooks/misc/useExtensions";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { LoadingSpinner } from "@/components/loading-spinner";
import { LanguageSwitcher } from "@/components/language-switcher";

function ExtensionPage() {
  const { route } = useParams();

  const windowSize = useWindowSize();
  const sideBarContext = useSideBarContext();
  const isCollapsed = sideBarContext?.isCollapsed ?? false;

  const client = useKeycloakClient();
  const extensionsHook = useExtensions(client.kc.token);

  const [contribution, setContribution] = useState<any>(null);

  const info: any = extensionsHook.userExtensions.find((info) => {
    return info.extension?.extensionId === route;
  });

  useEffect(() => {
    if (info) {
      if (info) {
        const contribution = exts.sdk.api.ui.getComponentById(
          info.extension.packageId
        );
        setContribution(contribution);
      }
    }
  }, [info, extensionsHook.components]);

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
      <div className="flex w-full h-full flex-col">
        <div
          className="flex flex-1 border-b"
          style={{
            maxWidth: `${windowSize.width - (isCollapsed ? 48 : 196)}px`,
            overflow: "auto",
            maxHeight: `${windowSize.height - (52 + 1)}px`,
          }}
        >
          {!extensionsHook.components ? (
            <div className="w-full h-full flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : contribution && contribution.component ? (
            <div
              key={contribution.id}
              className="extension-contribution flex w-full h-full "
            >
              <contribution.component {...(contribution.props || {})} />
            </div>
          ) : (
            <div
              className="flex flex-1 flex-col items-center justify-center w-full h-full relative"
              style={{ minHeight: `${windowSize.height - 53 - 50}px` }}
            >
              <div className="flex flex-1 w-full h-full relative">
                <svg
                  className="absolute inset-0 size-full z-0 stroke-foreground/10 m-0 p-0"
                  fill="none"
                >
                  <defs>
                    <pattern
                      id="pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e"
                      x="0"
                      y="0"
                      width="10"
                      height="10"
                      patternUnits="userSpaceOnUse"
                    >
                      <path d="M-3 13 15-5M-5 5l18-18M-1 21 17 3"></path>
                    </pattern>
                  </defs>
                  <rect
                    stroke="none"
                    fill="url(#pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e)"
                    width="100%"
                    height="100%"
                  ></rect>
                </svg>
              </div>

              <Card className="w-75 cursor-default rounded-sm bg-background absolute">
                <CardHeader className="pb-3 pt-3">
                  <CardTitle>Extensions</CardTitle>
                </CardHeader>
                <CardContent className="text-sm border py-4">
                  Component for extension with id {route} not found
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExtensionPage;
