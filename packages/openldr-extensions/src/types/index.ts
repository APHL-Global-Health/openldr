import { LucideIcon } from "lucide-react";

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string; // Entry point file
  icon: {
    menu?: LucideIcon;
    package: any;
  };
  contributes?: {
    commands?: Array<{ command: string; title: string }>;
    views?: Array<{ id: string; name: string; slot: string }>;
  };
  dependencies?: Record<string, string>;
  activationEvents?: string[];

  publisher: {
    displayName: string;
    domain: string;
  };
  lastUpdated: string;
  permissions: string[];
  installs: number;
  rating: number;
  ratingCount: number;
  license: string;
  repository: string;
  categories?: string[];
  tags?: string[];
  readme: string;
  features: string;
  changelog: string;
}

// Extension API interface that developers will implement
export interface Extension {
  id: string;
  name: string;
  version: string;
  link: string;
  icon: {
    menu?: any;
    package: any;
  };
  installed?: boolean;
  enabled?: boolean;
  activate: (context: ExtensionContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

export interface ExtensionContext {
  subscriptions: Disposable[];
  workspaceState: Memento;
  globalState: Memento;
  extensionPath: string;
  extensionUri: string;
}

export interface Disposable {
  dispose(): void;
}

export interface Memento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Promise<void>;
}

// UI Component Registry
export interface UIContribution {
  id: string;
  extensionId: string;
  component: React.ComponentType<any>;
  slot: "sidebar" | "panel" | "toolbar" | "statusbar" | "modal";
  props?: Record<string, any>;
}

export enum Permission {
  // File System
  FILE_READ = "file:read",
  FILE_WRITE = "file:write",

  // Network
  NETWORK_HTTP = "network:http",
  NETWORK_WEBSOCKET = "network:websocket",

  // Storage
  STORAGE_LOCAL = "storage:local",
  STORAGE_SYNC = "storage:sync",

  // UI
  UI_SIDEBAR = "ui:sidebar",
  UI_PANEL = "ui:panel",
  UI_TOOLBAR = "ui:toolbar",
  UI_MODAL = "ui:modal",
  UI_STATUSBAR = "ui:statusbar",
  UI_NOTIFICATIONS = "ui:notifications",

  // Commands
  COMMANDS_EXECUTE = "commands:execute",
  COMMANDS_REGISTER = "commands:register",

  // Clipboard
  CLIPBOARD_READ = "clipboard:read",
  CLIPBOARD_WRITE = "clipboard:write",

  // Workspace
  WORKSPACE_READ = "workspace:read",
  WORKSPACE_WRITE = "workspace:write",

  // Settings
  SETTINGS_READ = "settings:read",
  SETTINGS_WRITE = "settings:write",
}

export interface PermissionRequest {
  permission: Permission;
  reason: string;
}

export interface ExtensionBase {
  extensionId: string;
  packageId: string;
  name: string;
  description: string;
  author: string;
  authorDomain?: string;
  iconUrl?: string;
  categories: string[];
  tags: string[];
  totalDownloads: number;
  averageRating: number;
  ratingCount: number;
  license?: string;
  lastUpdated: string;
  latestVersion?: string;
}

export interface ExtensionVersion {
  versionId: string;
  extensionId: string;
  version: string;
  changelog?: string;
  codeUrl: string;
  mainFile: string;
  isBreaking: boolean;
  minAppVersion?: string;
  maxAppVersion?: string;
  manifest: any;
  activationEvents: string[];
  isPublished: boolean;
  isLatest: boolean;
  publishedAt: string;
  downloads: number;
}

export interface ExtensionUser {
  id: string;
  userId: string;
  extensionId: string;
  versionId: string;
  status: "installed" | "enabled" | "disabled" | "uninstalled";
  installedAt: string;
  enabledAt?: string;
  disabledAt?: string;
  lastUsedAt?: string;
  uninstalledAt?: string;
  settings: Record<string, any>;
  autoUpdate: boolean;
  extension?: ExtensionBase;
  version?: ExtensionVersion;
}

export interface ExtensionPermission {
  id: string;
  versionId: string;
  permission: string;
  description?: string;
  isDangerous: boolean;
}
