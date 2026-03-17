// openldr-sdk.d.ts
// Type definitions for the OpenLDR Extension SDK.
// Copy this file into your extension project for full IntelliSense support.
//
// The `openldr` global is injected by the host at activation time.
// For iframe extensions: window.openldr
// For worker extensions: the `openldr` parameter passed to activate(openldr)

declare const openldr: OpenLDR.SDK

declare namespace OpenLDR {
  // ── Core SDK ──────────────────────────────────────────────────────────────

  interface SDK {
    /** The extension's own ID, as declared in manifest.json */
    readonly extensionId: string

    /** Query data from the OpenLDR archives API */
    data: DataAPI

    /** UI integration: notifications, status bar, commands */
    ui: UIApi

    /** Cross-extension event bus */
    events: EventsAPI

    /** Persistent per-user key-value storage (backed by user_extensions.settings) */
    storage: StorageAPI

    /** Encrypted credential management (server-side) */
    credentials: CredentialsAPI
  }

  // ── Data API ──────────────────────────────────────────────────────────────

  type Schema = 'internal' | 'external'

  interface QueryParams {
    /** Column filters, e.g. { status: 'active', facility_id: 12 } */
    filters?: Record<string, unknown>
    /** Page number, 1-indexed (default: 1) */
    page?:    number
    /** Rows per page, max 500 (default: 100) */
    limit?:   number
    /** Sort order */
    sort?:    { field: string; direction: 'asc' | 'desc' }
  }

  interface QueryResult<T = Record<string, unknown>> {
    data:  T[]
    total: number
    page:  number
    limit: number
  }

  interface ExecResult {
    ok: boolean
    rows: Record<string, unknown>[]
    rowCount: number
    durationMs: number
    error?: string
  }

  interface DataAPI {
    /**
     * Query a table from the OpenLDR archives API.
     *
     * Requires the matching permission in manifest.json:
     *   schema=external, table=patients      → data.patients
     *   schema=external, table=lab_requests  → data.labRequests
     *   schema=external, table=lab_results   → data.labResults
     *   (or the broad data.query permission)
     */
    query<T = Record<string, unknown>>(
      schema: Schema,
      table:  string,
      params?: QueryParams
    ): Promise<QueryResult<T>>

    /**
     * Execute a pre-stored SQL script by ID.
     *
     * Scripts must be declared in manifest.json under the `scripts` field
     * and are uploaded to the server at publish time.
     *
     * Requires the `data.exec` permission.
     *
     * @param script  The script ID (key from manifest.scripts)
     * @param params  Optional parameter values to substitute ({{paramName}} placeholders)
     */
    exec(
      script: string,
      params?: Record<string, string | number | boolean | null>
    ): Promise<ExecResult>
  }

  // ── UI API ────────────────────────────────────────────────────────────────

  type NotificationKind = 'info' | 'success' | 'warning' | 'error'

  interface StatusBarHandle {
    setText(text: string, priority?: number): void
    hide(): void
  }

  interface CommandHandle {
    dispose(): void
  }

  interface UIApi {
    showNotification(message: string, kind?: NotificationKind): void
    statusBar: StatusBarHandle
    registerCommand(id: string, title: string, handler: (...args: unknown[]) => void): CommandHandle
  }

  // ── Events API ────────────────────────────────────────────────────────────

  interface EventHandle {
    dispose(): void
  }

  interface EventsAPI {
    on(event: string, handler: (payload: unknown) => void): EventHandle
    emit(event: string, payload?: unknown): void
  }

  // ── Storage API ───────────────────────────────────────────────────────────

  interface StorageAPI {
    get<T = unknown>(key: string): Promise<T | null>
    set(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<void>
  }

  // ── Credentials API ─────────────────────────────────────────────────────

  interface CredentialCheckResult {
    exists: boolean
    createdAt: string | null
    updatedAt: string | null
  }

  interface CredentialLoadResult {
    exists: boolean
    data: Record<string, string> | null
  }

  interface CredentialsAPI {
    /** Save credentials (encrypted server-side) */
    save(type: string, data: Record<string, string>): Promise<{ ok: boolean }>
    /** Check if credentials exist (does not return values) */
    check(type: string): Promise<CredentialCheckResult>
    /** Load saved credentials (decrypted server-side, returned over HTTPS) */
    load(type: string): Promise<CredentialLoadResult>
    /** Delete saved credentials */
    delete(type: string): Promise<{ ok: boolean }>
  }
}
