"use client";

import { NavLink, useLocation } from "react-router-dom";
import { Ellipsis, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { getMenuList } from "@/lib/menu-list";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CollapseMenuButton } from "@/components/admin-panel/collapse-menu-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useKeycloakClient } from "../react-keycloak-provider";
import { useEffect, useState } from "react";
// import { useExtensions } from "@/hooks/misc/useExtensions";
import { extensionEvents } from "@/lib/extensionEvents";
import { DynamicIcon } from "@/components/dynamicIcon";
import { useExtensions } from "@/hooks/misc/useExtensions";

interface MenuProps {
  isOpen: boolean | undefined;
}

const ENV = import.meta.env;
const baseUrl = ENV.VITE_BASE_URL || "/";

export function Menu({ isOpen }: MenuProps) {
  const client = useKeycloakClient();
  const location = useLocation();
  const pathname = location.pathname;

  // const extensionsHook = useExtensions(client.kc.token);
  const { state, dispatch } = useExtensions();
  const { activeActivity } = state;

  const installedWithView = state.extensions.filter(
    (e) => e.state === "active" && e.kind === "iframe",
  );
  const installedWorkers = state.extensions.filter(
    (e) => e.state === "active" && e.kind === "worker",
  );

  const errorCount = state.extensions.filter((e) => e.state === "error").length;

  const extensions: any = installedWithView.map((info) => {
    return {
      href: `${baseUrl}extension/${info.id}`,
      label: info.name,
      icon: info.icon,
    };
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const menuList = getMenuList(pathname, {
    canManageUsers: client.checkPermission("manage_users") === true,
    canUpload: client.checkPermission("upload") === true,
    canDelete: client.checkPermission("delete") === true,
    canExport: client.checkPermission("export") === true,
    extensions,
  });

  const isActive = (path: string) => {
    if (pathname === path) return true;
    return pathname.startsWith(path + "/");
  };

  // Helper to render icon
  const renderIcon = (icon: string | LucideIcon, className: string) => {
    if (typeof icon === "string") {
      // Remove < > / whitespace and convert to kebab-case friendly format
      const cleanedIcon = icon
        .replace(/<|>|\//g, "") // Remove JSX-like characters
        .trim() // Remove whitespace
        .toLowerCase(); // Convert to lowercase
      return <DynamicIcon iconName={cleanedIcon} className={className} />;
    }
    const Icon = icon;
    return <Icon className={className} />;
  };

  // Listen for extension changes
  useEffect(() => {
    const unsubscribe = extensionEvents.subscribe((detail) => {
      // console.log("MainPage received extension event:", detail);
      // Force re-render when extensions change
      setRefreshKey((prev) => prev + 1);
    });

    return unsubscribe;
  }, []);

  return (
    <ScrollArea className="[&>div>div[style]]:block! ">
      <nav className="mt-4 h-full w-full">
        <ul className="flex flex-col min-h-[calc(100vh-26px-48px-36px-16px-32px)] lg:min-h-[calc(100vh-26px-32px-40px-32px)] items-start space-y-1 px-2">
          {menuList.map(({ groupLabel, menus }, index) => (
            <li className={cn("w-full", groupLabel ? "pt-5" : "")} key={index}>
              {(isOpen && groupLabel) || isOpen === undefined ? (
                <p className="text-sm font-medium text-muted-foreground px-4 pb-2 max-w-62 truncate">
                  {groupLabel}
                </p>
              ) : !isOpen && isOpen !== undefined && groupLabel ? (
                <TooltipProvider>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger className="w-full">
                      <div className="w-full flex justify-center items-center">
                        <Ellipsis className="h-5 w-5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{groupLabel}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <p className="pb-2"></p>
              )}
              {menus.map(({ href, label, icon, active, submenus }, index) => {
                return !submenus || submenus.length === 0 ? (
                  <div
                    className="w-full"
                    key={`extension-${index}-${refreshKey}-${index}`}
                  >
                    <TooltipProvider disableHoverableContent>
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={
                              (active === undefined && isActive(href)) || active
                                ? "secondary"
                                : "ghost"
                            }
                            className="w-full justify-start h-10 mb-1"
                            asChild
                          >
                            <NavLink to={href}>
                              <span
                                className={cn(isOpen === false ? "" : "mr-4")}
                              >
                                {/* <Icon size={18} /> */}
                                {renderIcon(icon, "h-4 w-4")}
                              </span>
                              <p
                                className={cn(
                                  "max-w-50 truncate",
                                  isOpen === false
                                    ? "-translate-x-96 opacity-0"
                                    : "translate-x-0 opacity-100",
                                )}
                              >
                                {label}
                              </p>
                            </NavLink>
                          </Button>
                        </TooltipTrigger>
                        {isOpen === false && (
                          <TooltipContent side="right">{label}</TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : (
                  <div className="w-full" key={index}>
                    <CollapseMenuButton
                      icon={icon}
                      label={label}
                      active={active === undefined ? isActive(href) : active}
                      submenus={submenus}
                      isOpen={isOpen}
                    />
                  </div>
                );
              })}
            </li>
          ))}
          {/* <li className="w-full grow flex items-end">
            <TooltipProvider disableHoverableContent>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {}}
                    variant="outline"
                    className="w-full justify-center h-10 mt-5"
                  >
                    <span className={cn(isOpen === false ? "" : "mr-4")}>
                      <LogOut size={18} />
                    </span>
                    <p
                      className={cn(
                        "whitespace-nowrap",
                        isOpen === false ? "opacity-0 hidden" : "opacity-100",
                      )}
                    >
                      Sign out
                    </p>
                  </Button>
                </TooltipTrigger>
                {isOpen === false && (
                  <TooltipContent side="right">Sign out</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </li> */}
        </ul>
      </nav>
    </ScrollArea>
  );
}
