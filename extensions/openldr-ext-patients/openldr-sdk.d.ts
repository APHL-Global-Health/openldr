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

  interface DataAPI {
    /**
     * Query a table from the OpenLDR archives API.
     *
     * Requires the matching permission in manifest.json:
     *   schema=external, table=patients      → data.patients
     *   schema=external, table=lab_requests  → data.labRequests
     *   schema=external, table=lab_results   → data.labResults
     *   (or the broad data.query permission)
     *
     * @example
     * const result = await openldr.data.query('external', 'patients', {
     *   filters: { status: 'active' },
     *   limit: 50,
     *   sort: { field: 'created_at', direction: 'desc' }
     * })
     * console.log(result.data) // Patient[]
     */
    query<T = Record<string, unknown>>(
      schema: Schema,
      table:  string,
      params?: QueryParams
    ): Promise<QueryResult<T>>
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
}
