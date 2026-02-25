import * as exts from "@openldr/extensions";
import type { forEach } from "jszip";

import {
  FileText,
  LayoutGrid,
  type LucideIcon,
  Upload,
  Layers,
  Microscope,
  Users,
  Settings,
  SquareLibrary,
  Archive,
  Unplug,
  BookText,
  Bot,
  Box,
  Terminal,
} from "lucide-react";

type Submenu = {
  href: string;
  label: string;
  active?: boolean;
};

type Menu = {
  href: string;
  label: string;
  active?: boolean;
  icon: LucideIcon;
  submenus?: Submenu[];
};

type Group = {
  groupLabel: string;
  menus: Menu[];
};

const ENV = import.meta.env;
const baseUrl = ENV.VITE_BASE_URL || "/";

export function getMenuList(
  _pathname: string,
  options: {
    canUpload: boolean;
    canDelete: boolean;
    canExport: boolean;
    canManageUsers: boolean;
    extensions: any[]; //exts.types.ExtensionUser[];
  },
): Group[] {
  const extenstionsOptions = [
    {
      groupLabel: "Extensions",
      menus: [
        {
          href: `${baseUrl}extensions`,
          label: "Extensions",
          // icon: Unplug,
          icon: Box,
        },
        ...(options?.extensions || []),
      ],
    },
  ];

  const menuOptions = [
    {
      groupLabel: "",
      menus: [
        {
          href: baseUrl,
          label: "Dashboard",
          icon: LayoutGrid,
          submenus: [],
        },
      ],
    },
    {
      groupLabel: "Contents",
      menus: [
        {
          href: `${baseUrl}data-entry`,
          label: "Data Entry",
          icon: SquareLibrary,
        },
        {
          href: `${baseUrl}archives`,
          label: "Archives",
          icon: Archive,
        },
        {
          href: `${baseUrl}reports`,
          label: "Reports",
          icon: FileText,
        },
        {
          href: `${baseUrl}chats`,
          label: "chats",
          icon: Bot,
        },
        //TODO add later
        // {
        //   href: `${baseUrl}docs`,
        //   label: "Documentation",
        //   icon: BookText,
        // },
      ],
    },
    ...extenstionsOptions,
    {
      groupLabel: "Settings",
      menus: [
        {
          href: `${baseUrl}logs`,
          label: "logs",
          icon: Terminal,
        },
        {
          href: `${baseUrl}settings`,
          label: "Settings",
          icon: Settings,
        },
        // {
        //   href: "/users",
        //   label: "Users",
        //   icon: Users,
        // },
      ],
    },
  ];

  return menuOptions;
}
