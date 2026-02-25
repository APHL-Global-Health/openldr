export type ExtensionKind = "worker" | "iframe";
export type ExtensionSlot = "main" | "secondary" | "sidebar";
export type NotificationKind = "info" | "warning" | "error" | "success";

export interface CommandContribution {
  id: string;
  title: string;
}

export interface ViewContribution {
  id: string;
  slot: ExtensionSlot;
  title: string;
}

export interface ExtensionContributes {
  commands: CommandContribution[];
  views: ViewContribution[];
}

/** What the registry stores internally — includes the raw code payload */
export interface ExtensionRecord {
  manifest: ExtensionManifest;
  /** Raw JS code for worker extensions */
  code?: string;
  /** Raw HTML (with {{BRIDGE}} placeholder) for iframe extensions */
  html?: string;
}

/** The public-facing manifest returned to clients */
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  kind: ExtensionKind;
  slot?: ExtensionSlot;
  activationEvents: string[];
  contributes: ExtensionContributes;
  author: string;
  icon: string;
  /** SHA-256 hash of the code/html payload, base64-encoded */
  integrity: string;
  /** ISO timestamp of when this extension was registered */
  publishedAt: string;
  /** Explicit permissions the extension requires */
  permissions: ExtensionPermission[];
  /** Endpoint to fetch the code/html payload */
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
  kind: ExtensionKind;
  /** The raw payload — JS for workers, HTML for iframes */
  payload: string;
  /** SHA-256 base64 integrity hash — client MUST verify this */
  integrity: string;
  /** Unix timestamp — clients can cache until this time */
  cacheUntil: number;
}

export interface ApiError {
  error: string;
  code: string;
  status: number;
}
