import { types } from "@openldr/extensions";
import { WORKER_BOOTSTRAP, IFRAME_BRIDGE } from "@/lib/extensions";

export type DispatchFn = (action: { type: string; payload?: unknown }) => void;

export interface LoaderConfig {
  baseUrl: string;
  token?: string | undefined;
  apiKey?: string;
}

export interface ExtensionState extends types.ExtensionManifest {
  state:
    | "fetching"
    | "pending-permission"
    | "activating"
    | "active"
    | "error"
    | "inactive";
  error: string | null;
  enabled: boolean;
  payload?: string;
}

export interface AppState {
  extensions: ExtensionState[];
  commands: Array<{ id: string; title: string; extensionId: string }>;
  notifications: Array<{
    id: number;
    message: string;
    kind: types.NotificationKind;
    extId: string;
    ts: string;
  }>;
  statusBar: Array<{ id: string; text: string; priority: number }>;
  logs: Array<{
    id: number;
    extId: string;
    direction: string;
    event: string;
    args: unknown[];
    ts: string;
  }>;
  commandPaletteOpen: boolean;
  activeTab: string;
  activeSecondaryTab: string;
  devConsoleOpen: boolean;
  appEvents: Array<{ event: string; payload: unknown }>;
  apiConfigOpen: boolean;
  permissionPrompt: null | {
    extId: string;
    permissions: string[];
    resolve: () => void;
    reject: () => void;
  };
  // VSCode-style navigation
  activeActivity: string | null; // 'extensions' | 'architecture' | extId
  selectedExtId: string | null; // which extension is selected in the list
  // auth: AuthState;
  apiBase: string;
}

export const STATE_DOT: Record<string, string> = {
  inactive: "bg-border",
  active: "bg-[#34d399] shadow-[0_0_5px_#34d39970]",
  error: "bg-[#f87171]",
  fetching: "bg-[#a78bfa] animate-pulse",
  activating: "bg-[#f59e0b] animate-pulse",
  "pending-permission": "bg-[#f59e0b]",
};

export async function verifyIntegrity(
  payload: string,
  expectedIntegrity: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    const hash64 = btoa(String.fromCharCode(...new Uint8Array(hashBuf)));
    const computed = `sha256-${hash64}`;
    const match = computed === expectedIntegrity;
    if (!match)
      console.error(
        `[IntegrityCheck] FAILED\n  expected: ${expectedIntegrity}\n  got: ${computed}`,
      );
    return match;
  } catch (err) {
    console.error("[IntegrityCheck] crypto.subtle unavailable:", err);
    return false;
  }
}

export class ExtensionHost {
  private dispatch: DispatchFn;
  private workers = new Map<string, Worker>();
  private iframes = new Map<string, HTMLIFrameElement>();
  commands = new Map<string, { title: string; extensionId: string }>();
  statusItems = new Map<string, { text: string; priority: number }>();
  private subs = new Map<string, Set<string>>();
  private apiBase: string;
  private getToken: () => string;

  constructor(dispatch: DispatchFn, apiBase: string, getToken: () => string) {
    this.dispatch = dispatch;
    this.apiBase = apiBase;
    this.getToken = getToken;
    this._handleWindowMessage = this._handleWindowMessage.bind(this);
    window.addEventListener("message", this._handleWindowMessage);
  }

  updateApiBase(base: string) {
    this.apiBase = base;
  }

  destroy() {
    window.removeEventListener("message", this._handleWindowMessage);
    this.workers.forEach((w) => w.terminate());
  }

  private _handleExtensionEvent(event: string, args: unknown[], extId: string) {
    this.dispatch({
      type: "EXT_LOG",
      payload: { extId, direction: "out", event, args },
    });
    switch (event) {
      case "ui.notification":
        this.dispatch({
          type: "ADD_NOTIFICATION",
          payload: { message: args[0], kind: args[1] || "info", extId },
        });
        break;
      case "ui.statusBar.setText": {
        const [text, priority] = args as [string, number];
        this.statusItems.set(extId, { text, priority: priority || 0 });
        this.dispatch({
          type: "STATUS_UPDATE",
          payload: [...this.statusItems.entries()].map(([id, v]) => ({
            id,
            ...v,
          })),
        });
        break;
      }
      case "ui.statusBar.hide":
        this.statusItems.delete(extId);
        this.dispatch({
          type: "STATUS_UPDATE",
          payload: [...this.statusItems.entries()].map(([id, v]) => ({
            id,
            ...v,
          })),
        });
        break;
      case "ui.command.register":
        this.commands.set(args[0] as string, {
          title: args[1] as string,
          extensionId: extId,
        });
        this.dispatch({
          type: "ADD_COMMAND",
          payload: { id: args[0], title: args[1], extensionId: extId },
        });
        break;
      case "ui.command.unregister":
        this.commands.delete(args[0] as string);
        this.dispatch({ type: "REMOVE_COMMAND", payload: args[0] });
        break;
      case "events.subscribe": {
        if (!this.subs.has(extId)) this.subs.set(extId, new Set());
        this.subs.get(extId)!.add(args[0] as string);
        break;
      }
      case "events.emit":
        this._broadcastAppEvent(args[0] as string, args[1], extId);
        break;
      case "extension.error":
        this.dispatch({
          type: "EXT_STATE",
          payload: { extId, state: "error", error: args[0] },
        });
        break;
    }
  }

  private _broadcastAppEvent(
    event: string,
    payload: unknown,
    sourceExtId: string,
  ) {
    this.dispatch({ type: "APP_EVENT", payload: { event, payload } });
    const msg = { _appEvent: event, _payload: payload };
    this.workers.forEach((w, id) => {
      if (id !== sourceExtId && this.subs.get(id)?.has(event))
        w.postMessage(msg);
    });
    this.iframes.forEach((frame, id) => {
      if (id !== sourceExtId && this.subs.get(id)?.has(event))
        frame.contentWindow?.postMessage(msg, "*");
    });
  }

  private _handleWindowMessage(e: MessageEvent) {
    const m = e.data;
    if (!m || !m._fromIframe || !m._extId) return;
    this.dispatch({
      type: "EXT_LOG",
      payload: {
        extId: m._extId,
        direction: "in",
        event: m._event || m._method || "rpc",
        args: m._args || [],
      },
    });
    if (m._event) this._handleExtensionEvent(m._event, m._args || [], m._extId);
  }

  private _handleWorkerMessage(extId: string, e: MessageEvent) {
    const m = e.data;
    if (!m) return;
    this.dispatch({
      type: "EXT_LOG",
      payload: {
        extId,
        direction: "in",
        event: m._event || m._method || "rpc",
        args: m._args || [],
      },
    });
    if (m._event) this._handleExtensionEvent(m._event, m._args || [], extId);
  }

  async loadWorkerExtension(ext: ExtensionState, code: string) {
    this.dispatch({
      type: "EXT_STATE",
      payload: { extId: ext.id, state: "activating" },
    });
    const token = this.getToken();
    const bootstrap = WORKER_BOOTSTRAP(ext.id, this.apiBase, token);
    const fullCode = bootstrap + "\n\n" + code;
    const blob = new Blob([fullCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url, { type: "classic" });
    worker.onmessage = (e) => this._handleWorkerMessage(ext.id, e);
    worker.onerror = (e) =>
      this.dispatch({
        type: "EXT_STATE",
        payload: { extId: ext.id, state: "error", error: e.message },
      });
    this.workers.set(ext.id, worker);
    worker.postMessage({ _type: "activate" });
    await new Promise<void>((res, rej) => {
      const t = setTimeout(
        () => rej(new Error("Worker activation timeout")),
        10000,
      );
      const orig = worker.onmessage!;
      worker.onmessage = (e) => {
        if (
          e.data?._event === "extension.activated" ||
          e.data?._event === "ui.statusBar.setText"
        ) {
          clearTimeout(t);
          res();
        } else {
          (orig as (e: MessageEvent) => void)(e);
        }
        worker.onmessage = orig;
      };
    }).catch(() => {}); // timeout is non-fatal — worker may still be alive
    this.dispatch({
      type: "EXT_STATE",
      payload: { extId: ext.id, state: "active" },
    });
    URL.revokeObjectURL(url);
  }

  loadIframeExtension(ext: ExtensionState) {
    this.dispatch({
      type: "EXT_STATE",
      payload: { extId: ext.id, state: "active" },
    });
  }

  invokeCommand(commandId: string, args: unknown[] = []) {
    const cmd = this.commands.get(commandId);
    if (!cmd) return;
    const worker = this.workers.get(cmd.extensionId);
    if (worker) worker.postMessage({ _invokeCommand: commandId, _args: args });
    const iframe = this.iframes.get(cmd.extensionId);
    if (iframe)
      iframe.contentWindow?.postMessage(
        { _invokeCommand: commandId, _args: args },
        "*",
      );
  }

  registerIframe(extId: string, el: HTMLIFrameElement) {
    this.iframes.set(extId, el);
  }
  unregisterIframe(extId: string) {
    this.iframes.delete(extId);
  }

  deactivate(extId: string) {
    const worker = this.workers.get(extId);
    if (worker) {
      worker.terminate();
      this.workers.delete(extId);
    }
    this.iframes.delete(extId);
    this.statusItems.delete(extId);
    this.subs.delete(extId);
    const cmdsToRemove = [...this.commands.entries()]
      .filter(([, v]) => v.extensionId === extId)
      .map(([k]) => k);
    cmdsToRemove.forEach((k) => this.commands.delete(k));
    this.dispatch({
      type: "EXT_STATE",
      payload: { extId, state: "inactive", payload: undefined },
    });
    this.dispatch({
      type: "STATUS_UPDATE",
      payload: [...this.statusItems.entries()].map(([id, v]) => ({ id, ...v })),
    });
    this.dispatch({ type: "REMOVE_COMMANDS_BY_EXT", payload: extId });
  }
}

export class ExtensionLoader {
  private config: LoaderConfig;
  private manifestCache = new Map<string, types.ExtensionManifest>();
  private payloadCache = new Map<string, types.ExtensionCodeResponse>();

  constructor(config: LoaderConfig) {
    this.config = config;
  }

  updateConfig(config: LoaderConfig) {
    this.config = config;
    this.manifestCache.clear();
    this.payloadCache.clear();
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.token) h["Authorization"] = `Bearer ${this.config.token}`;
    if (this.config.apiKey) h["X-API-Key"] = this.config.apiKey;
    return h;
  }

  async fetchRegistry(): Promise<types.RegistryResponse> {
    const res = await fetch(`${this.config.baseUrl}/api/v1/extensions`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Registry fetch failed: ${res.status}`);
    }
    const data: types.RegistryResponse = await res.json();
    data.extensions.forEach((m) => this.manifestCache.set(m.id, m));
    return data;
  }

  async fetchManifest(id: string): Promise<types.ExtensionManifest> {
    if (this.manifestCache.has(id)) return this.manifestCache.get(id)!;
    const res = await fetch(`${this.config.baseUrl}/api/v1/extensions/${id}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
    const manifest: types.ExtensionManifest = await res.json();
    this.manifestCache.set(id, manifest);
    return manifest;
  }

  async fetchAndVerifyPayload(
    manifest: types.ExtensionManifest,
  ): Promise<types.ExtensionCodeResponse> {
    const cached = this.payloadCache.get(manifest.id);
    if (cached && cached.cacheUntil > Date.now()) return cached;
    const res = await fetch(manifest.codeUrl, { headers: this.headers() });
    if (!res.ok) throw new Error(`Payload fetch failed: ${res.status}`);
    const codeResp: types.ExtensionCodeResponse = await res.json();
    const valid = await verifyIntegrity(codeResp.payload, codeResp.integrity);
    if (!valid)
      throw new Error(
        `Integrity verification FAILED for extension "${manifest.id}". The payload may have been tampered with.`,
      );
    if (codeResp.integrity !== manifest.integrity)
      throw new Error(
        `Integrity mismatch: payload hash does not match manifest for "${manifest.id}".`,
      );
    console.log(`[Loader] ✓ Integrity verified for "${manifest.id}"`);
    this.payloadCache.set(manifest.id, codeResp);
    return codeResp;
  }
}

export interface UserExtensionInstall {
  extensionId: string;
  installedAt: string;
  approvedPermissions: string[];
  settings: Record<string, unknown>;
  extension: {
    id: string;
    name: string;
    version: string;
    description: string;
    kind: "worker" | "iframe";
    slot?: string;
    activationEvents: string[];
    contributes: {
      commands: Array<{ id: string; title: string }>;
      views: Array<{ id: string; slot: string; title: string }>;
    };
    author: string;
    icon: string;
    integrity: string;
    publishedAt: string;
    permissions: string[];
    codeUrl: string;
  };
}

export interface UserExtensionsResponse {
  installs: UserExtensionInstall[];
  total: number;
}

export interface ParsedBundle {
  manifest: Record<string, unknown>;
  payloadSize: number;
  payloadFile: string;
  file: File;
}
