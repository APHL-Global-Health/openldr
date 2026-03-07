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
  Form,
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
      groupLabel: "navigation.extensions",
      menus: [
        {
          href: `${baseUrl}extensions`,
          label: "navigation.extensions",
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
          label: "navigation.dashboard",
          icon: LayoutGrid,
          submenus: [],
        },
      ],
    },
    {
      groupLabel: "navigation.contents",
      menus: [
        {
          href: `${baseUrl}data-entry`,
          label: "navigation.data_entry",
          icon: SquareLibrary,
        },
        {
          href: `${baseUrl}archives`,
          label: "navigation.archives",
          icon: Archive,
        },
        {
          href: `${baseUrl}forms`,
          label: "navigation.forms",
          icon: Form,
        },
        {
          href: `${baseUrl}reports`,
          label: "navigation.reports",
          icon: FileText,
        },
        {
          href: `${baseUrl}chats`,
          label: "navigation.chats",
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
      groupLabel: "navigation.settings",
      menus: [
        {
          href: `${baseUrl}logs`,
          label: "navigation.logs",
          icon: Terminal,
        },
        {
          href: `${baseUrl}settings`,
          label: "navigation.settings",
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
