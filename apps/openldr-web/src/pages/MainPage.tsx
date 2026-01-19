import { Outlet } from "react-router-dom";

import {
  Archive,
  BookText,
  LayoutDashboard,
  Settings,
  SquareLibrary,
  Unplug,
  Waypoints,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Nav } from "@/components/nav";
import { useSideBarContext } from "@/components/sidebar-provider";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { useExtensions } from "@/hooks/misc/useExtensions";

import logoImage from "@/assets/OpenODRv2Logo.png";
import { extensionEvents } from "@/lib/extensionEvents";
import { useEffect, useState } from "react";

function MainPage() {
  const client = useKeycloakClient();
  const keycloak = client.kc;
  const hasPriviledges = keycloak.hasRealmRole(
    import.meta.env.VITE_PRIVILEDGED_ROLE || "user"
  );

  const sideBarContext = useSideBarContext();
  const isCollapsed = sideBarContext?.isCollapsed ?? false;
  const setIsCollapsed = sideBarContext?.setIsCollapsed ?? (() => {});
  const isMac = false;

  const extensionsHook = useExtensions(client.kc.token);
  const extensions: any = extensionsHook.userExtensions;
  const [refreshKey, setRefreshKey] = useState(0);

  const ENV = import.meta.env;
  const baseUrl = ENV.VITE_BASE_URL || "/";

  // Listen for extension changes
  useEffect(() => {
    const unsubscribe = extensionEvents.subscribe((detail) => {
      // console.log("MainPage received extension event:", detail);
      // Force re-render when extensions change
      setRefreshKey((prev) => prev + 1);
    });

    return unsubscribe;
  }, []);

  let links = [
    {
      title: "Dashbard",
      label: "",
      icon: LayoutDashboard,
      to: baseUrl,
    },
    {
      title: "Data Entry",
      label: "",
      icon: SquareLibrary,
      to: `${baseUrl}data-entry`,
    },
  ];
  if (hasPriviledges) {
    links = [
      {
        title: "Dashbard",
        label: "",
        icon: LayoutDashboard,
        to: baseUrl,
      },
      {
        title: "Data Entry",
        label: "",
        icon: SquareLibrary,
        to: `${baseUrl}data-entry`,
      },

      { title: "Archive", label: "", icon: Archive, to: `${baseUrl}archive` },
      //TODO Improve later
      // {
      //   title: "Open Concept Lab",
      //   label: "",
      //   icon: Waypoints,
      //   to: `${baseUrl}ocl`,
      // },
    ];
  }

  return (
    <div className="flex w-full h-full">
      <TooltipProvider delayDuration={0}>
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full items-stretch"
        >
          <ResizablePanel
            defaultSize={10}
            collapsedSize={isMac ? 3 : 4}
            collapsible={true}
            minSize={10}
            maxSize={10}
            onCollapse={() => {
              setIsCollapsed(true);
            }}
            onExpand={() => {
              setIsCollapsed(false);
            }}
            className={cn(
              isCollapsed && "transition-all duration-300 ease-in-out min-w-12",
              !isCollapsed && "min-w-49"
            )}
          >
            <div
              className={cn(
                "flex h-13 items-center ml-2",
                isCollapsed ? "h-13" : "px-2"
              )}
            >
              <div
                className={cn(
                  "w-5.5 overflow-hidden",
                  isCollapsed ? "ml-1.5" : ""
                )}
              >
                <img
                  src={logoImage}
                  alt="openldr"
                  className="h-6 object-cover object-left"
                />
              </div>

              <div
                className={cn(
                  isCollapsed
                    ? "hidden w-0 overflow-hidden"
                    : "ml-3 w-16 overflow-hidden"
                )}
              >
                <img
                  src={logoImage}
                  alt="openldr"
                  className="h-6.5 object-cover object-right"
                />
              </div>
            </div>
            <Separator />
            <Nav isCollapsed={isCollapsed} links={links} />
            <Separator />
            <div className="flex flex-col py-2 space-y-1">
              <Nav
                className="py-0 data-[collapsed=true]:py-0"
                isCollapsed={isCollapsed}
                links={[
                  {
                    title: "Extensions",
                    label: "",
                    icon: Unplug,
                    to: `${baseUrl}extensions`,
                  },
                ]}
              />
              {extensions
                .filter((extension) => extension.status === "enabled")
                .map((extension, index) => {
                  const _extension = extension.extension;
                  return (
                    <Nav
                      className="py-0 data-[collapsed=true]:py-0"
                      key={`extension-${index}-${refreshKey}-${extension.id}`}
                      isCollapsed={isCollapsed}
                      links={[
                        {
                          title: _extension.name,
                          label: "",
                          icon: extension.version.manifest.icon.menu,
                          to: `${baseUrl}extension/${_extension.extensionId}`,
                        },
                      ]}
                    />
                  );
                })}
            </div>
            <Separator />
            <Nav
              isCollapsed={isCollapsed}
              links={[
                {
                  title: "Documentation",
                  label: "",
                  icon: BookText,
                  to: `${baseUrl}docs`,
                },
                {
                  title: "Settings",
                  label: "",
                  icon: Settings,
                  to: `${baseUrl}settings`,
                },
              ]}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>
            <Outlet />
          </ResizablePanel>
        </ResizablePanelGroup>
      </TooltipProvider>
    </div>
  );
}

export default MainPage;
