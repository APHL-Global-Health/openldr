"use client";

import { NavLink, useLocation } from "react-router-dom";
import { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DynamicIcon } from "./dynamicIcon";

interface NavProps {
  isCollapsed: boolean;
  links: {
    title: string;
    label?: string;
    icon: string | LucideIcon; // Can be either string or component
    to: string;
  }[];
  className?: string;
}

export function Nav({ links, isCollapsed, className }: NavProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    return location.pathname.startsWith(path + "/");
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

  return (
    <div
      data-collapsed={isCollapsed}
      className={cn(
        "group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2",
        className
      )}
    >
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link, index) => {
          return isCollapsed ? (
            <Tooltip key={index} delayDuration={0}>
              <TooltipTrigger asChild>
                <NavLink
                  to={link.to}
                  className={cn(
                    buttonVariants({
                      variant: isActive(link.to) ? "default" : "ghost",
                      size: "icon",
                    }),
                    "h-9 w-9",
                    isActive(link.to) &&
                      "dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-white rounded-xs"
                  )}
                >
                  {/* <link.icon className="h-4 w-4" /> */}
                  {renderIcon(link.icon, "h-4 w-4")}
                  <span className="sr-only">{link.title}</span>
                </NavLink>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="flex items-center gap-4 rounded-xs"
              >
                {link.title}
                {link.label && (
                  <span className="ml-auto text-muted-foreground">
                    {link.label}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <NavLink
              key={index}
              to={link.to}
              className={cn(
                buttonVariants({
                  variant: isActive(link.to) ? "default" : "ghost",
                  size: "sm",
                }),
                isActive(link.to) &&
                  "dark:bg-muted dark:text-white dark:hover:bg-muted dark:hover:text-white rounded-xs",
                "justify-start  text-xs"
              )}
            >
              {renderIcon(link.icon, "mr-2 h-4 w-4")}
              {/* <link.icon className="mr-2 h-4 w-4" /> */}
              {link.title}
              {link.label && (
                <span
                  className={cn(
                    "ml-auto",
                    location.pathname === link.to &&
                      "text-background dark:text-white"
                  )}
                >
                  {link.label}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
