import * as exts from "@openldr/extensions";

export interface MinioUploadResult {
  bucket: string;
  key: string;
  path: string;
  size: number;
}

export interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  adminUsername?: string;
  adminPassword?: string;
}

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  attributes?: Record<string, string[]>;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  credentials?: Array<{
    type: string;
    value: string;
    temporary: boolean;
  }>;
  attributes?: Record<string, string[]>;
}

export interface CreateUserDto {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  credentials?: Array<{
    type: string;
    value: string;
    temporary: boolean;
  }>;
  attributes?: Record<string, string[]>;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  attributes?: Record<string, string[]>;
}

export interface PluginParams {
  pluginId: string;
  pluginType: string;
  pluginName: string;
  pluginVersion: string;
  pluginData?: any;
  pluginMinioObjectPath: string;
  securityLevel: string;
  config?: any;
  notes: string;
}

export interface DecodedToken {
  client_id: string;
  sub: string;
  azp: string;
  preferred_username?: string;
  email?: string;
  exp: number;
  iat: number;
}

/** What the registry stores internally — includes the raw code payload */
export interface ExtensionRecord {
  manifest: ExtensionManifest;
  code?: string;
  html?: string;
}

/** The public-facing manifest returned to clients */
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  kind: exts.types.ExtensionKind;
  slot?: exts.types.ExtensionSlot;
  activationEvents: string[];
  contributes: exts.types.ExtensionContributes;
  author: string;
  icon: string;
  integrity: string;
  publishedAt: string;
  permissions: ExtensionPermission[];
  codeUrl: string;
}

export type ExtensionPermission =
  | "data.query"
  | "data.specimens"
  | "data.resistanceStats"
  | "storage.read"
  | "storage.write"
  | "ui.notifications"
  | "ui.statusBar"
  | "ui.commands"
  | "events.emit"
  | "events.subscribe";

export interface RegistryResponse {
  extensions: ExtensionManifest[];
  total: number;
  apiVersion: string;
}

export interface ExtensionCodeResponse {
  id: string;
  kind: exts.types.ExtensionKind;
  payload: string;
  integrity: string;
  cacheUntil: number;
}

export interface ExtensionRow {
  id: string;
  name: string;
  version: string;
  description: string;
  kind: "worker" | "iframe";
  slot: string | null;
  activation_events: string[];
  contributes: ExtensionManifest["contributes"];
  author: string;
  icon: string;
  integrity: string;
  permissions: string[];
  storage_key?: string;
  published_at: string;
}

export interface UserExtensionInstall {
  extensionId: string;
  installedAt: string;
  approvedPermissions: string[];
  settings: Record<string, unknown>;
  extension: exts.types.ExtensionManifest;
}
