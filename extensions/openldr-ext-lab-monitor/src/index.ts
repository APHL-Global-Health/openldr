// src/index.ts — Lab Surveillance Monitor (Worker Extension)
//
// Runs entirely in the background with no UI of its own.
// On a configurable interval it:
//   1. Queries lab_requests for overdue pending requests
//   2. Queries lab_results for a rolling abnormal-rate snapshot
//   3. Compares against thresholds from storage (or defaults)
//   4. Fires notifications + emits events if thresholds are breached
//   5. Updates the status bar with a live health indicator
//
// Other extensions can subscribe to:
//   'monitor.alert'    — { kind, message, count, checkedAt }
//   'monitor.summary'  — { pendingOverdue, abnormalRate, checkedAt }
//   'data.refresh'     — emitted after every successful check so the
//                        patients/lab-results extensions reload their data

// ── Types ─────────────────────────────────────────────────────────────────

interface LabRequest {
  id: number;
  request_id?: string;
  status?: string;
  created_at?: string;
  priority?: string;
  facility_id?: number;
  [key: string]: unknown;
}

interface LabResult {
  id: number;
  result_id?: string;
  interpretation?: string;
  status?: string;
  resulted_at?: string;
  [key: string]: unknown;
}

interface MonitorConfig {
  intervalMs: number; // how often to check (default: 5 min)
  pendingThresholdHrs: number; // hrs before a pending request is "overdue"
  abnormalRateThreshold: number; // 0–1, fraction of abnormal results to alert on
  enabled: boolean;
}

interface CheckSummary {
  pendingOverdue: number;
  totalPending: number;
  abnormalCount: number;
  totalResults: number;
  abnormalRate: number;
  checkedAt: string;
  alertsFired: string[];
}

// ── Default config ────────────────────────────────────────────────────────

const DEFAULTS: MonitorConfig = {
  intervalMs: 5 * 60 * 1000, // 5 minutes
  pendingThresholdHrs: 24, // flag requests pending > 24hrs
  abnormalRateThreshold: 0.3, // alert if >30% results are abnormal
  enabled: true,
};

// ── State ─────────────────────────────────────────────────────────────────

let config: MonitorConfig = { ...DEFAULTS };
let lastSummary: CheckSummary | null = null;
let checkTimer: ReturnType<typeof setTimeout> | null = null;
let paused = false;
let checkCount = 0;

// ── Helpers ───────────────────────────────────────────────────────────────

function hoursAgo(hrs: number): string {
  return new Date(Date.now() - hrs * 60 * 60 * 1000).toISOString();
}

function isAbnormal(result: LabResult): boolean {
  const interp = (result.interpretation || "").toLowerCase();
  return (
    interp.includes("high") ||
    interp.includes("low") ||
    interp.includes("above") ||
    interp.includes("below") ||
    interp.includes("positive") ||
    interp.includes("critical") ||
    interp.includes("abnormal")
  );
}

function statusIcon(summary: CheckSummary): string {
  if (summary.alertsFired.length > 0) return "🔴";
  if (summary.abnormalRate > config.abnormalRateThreshold * 0.75) return "🟡";
  return "🟢";
}

function fmtRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// ── Surveillance check ────────────────────────────────────────────────────

async function runCheck(): Promise<void> {
  if (paused) return;
  checkCount++;

  openldr.ui.statusBar.setText("🔬 Checking…", 20);

  const alerts: string[] = [];
  const summary: CheckSummary = {
    pendingOverdue: 0,
    totalPending: 0,
    abnormalCount: 0,
    totalResults: 0,
    abnormalRate: 0,
    checkedAt: new Date().toISOString(),
    alertsFired: [],
  };

  // ── 1. Overdue pending requests ─────────────────────────────────────────
  try {
    const cutoff = hoursAgo(config.pendingThresholdHrs);

    // Fetch all pending requests — paginate to get accurate counts
    let page = 1;
    let totalPending = 0;
    let overdueCount = 0;

    while (true) {
      const resp = await openldr.data.query<LabRequest>(
        "external",
        "lab_requests",
        {
          filters: { status: "pending" },
          page,
          limit: 500,
          sort: { field: "created_at", direction: "asc" },
        },
      );

      totalPending += resp.data.length;

      for (const req of resp.data) {
        const createdAt = req.created_at as string | undefined;
        if (createdAt && createdAt < cutoff) overdueCount++;
      }

      if (resp.data.length < 500 || totalPending >= resp.total) break;
      page++;
    }

    summary.totalPending = totalPending;
    summary.pendingOverdue = overdueCount;

    if (overdueCount > 0) {
      const msg = `${overdueCount} pending lab request${overdueCount > 1 ? "s" : ""} overdue (>${config.pendingThresholdHrs}h)`;
      alerts.push(msg);
      openldr.ui.showNotification(
        msg,
        overdueCount >= 10 ? "error" : "warning",
      );
      openldr.events.emit("monitor.alert", {
        kind: "overdue_requests",
        message: msg,
        count: overdueCount,
        checkedAt: summary.checkedAt,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LabMonitor] Failed to fetch lab_requests:", msg);
    // Non-fatal — continue to results check
  }

  // ── 2. Abnormal result rate ─────────────────────────────────────────────
  try {
    // Look at results from the last 24 hours for a rolling rate
    const since = hoursAgo(24);

    const resp = await openldr.data.query<LabResult>(
      "external",
      "lab_results",
      {
        filters: {},
        page: 1,
        limit: 500,
        sort: { field: "resulted_at", direction: "desc" },
      },
    );

    // Filter to last 24h if resulted_at is available
    const recent = resp.data.filter((r) => {
      const d = r.resulted_at as string | undefined;
      return !d || d >= since;
    });

    const total = recent.length || resp.data.length;
    const abnormal = (recent.length > 0 ? recent : resp.data).filter(
      isAbnormal,
    ).length;
    const rate = total > 0 ? abnormal / total : 0;

    summary.totalResults = total;
    summary.abnormalCount = abnormal;
    summary.abnormalRate = rate;

    if (rate > config.abnormalRateThreshold && total >= 10) {
      const msg = `Abnormal result rate: ${fmtRate(rate)} (${abnormal}/${total} in last 24h)`;
      alerts.push(msg);
      openldr.ui.showNotification(msg, rate > 0.5 ? "error" : "warning");
      openldr.events.emit("monitor.alert", {
        kind: "high_abnormal_rate",
        message: msg,
        rate,
        count: abnormal,
        total,
        checkedAt: summary.checkedAt,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LabMonitor] Failed to fetch lab_results:", msg);
  }

  // ── 3. Finalise summary ─────────────────────────────────────────────────

  summary.alertsFired = alerts;
  lastSummary = summary;

  // Persist for showSummary command
  await openldr.storage.set("lastSummary", summary).catch(() => {});
  await openldr.storage.set("checkCount", checkCount).catch(() => {});

  // Status bar
  const icon = statusIcon(summary);
  const label =
    summary.totalPending > 0
      ? `${icon} ${summary.pendingOverdue} overdue · ${fmtRate(summary.abnormalRate)} abnormal`
      : `${icon} ${fmtRate(summary.abnormalRate)} abnormal`;

  openldr.ui.statusBar.setText(`🔬 ${label}`, 20);

  // Broadcast summary for other extensions
  openldr.events.emit("monitor.summary", summary);

  // Tell the other extensions to refresh their views
  if (checkCount > 1) {
    openldr.events.emit("data.refresh", {
      source: "lab-monitor",
      checkedAt: summary.checkedAt,
    });
  }

  // Schedule next check
  scheduleNext();
}

// ── Scheduler ─────────────────────────────────────────────────────────────

function scheduleNext(): void {
  if (checkTimer) clearTimeout(checkTimer);
  checkTimer = setTimeout(runCheck, config.intervalMs);
}

// ── Commands ───────────────────────────────────────────────────────────────

function registerCommands(): void {
  openldr.ui.registerCommand(
    "labMonitor.runCheck",
    "Lab Monitor: Run surveillance check now",
    () => {
      openldr.ui.showNotification("Running lab surveillance check…", "info");
      runCheck();
    },
  );

  openldr.ui.registerCommand(
    "labMonitor.showSummary",
    "Lab Monitor: Show last summary",
    () => {
      if (!lastSummary) {
        openldr.ui.showNotification("No check has run yet", "info");
        return;
      }
      const s = lastSummary;
      const lines = [
        `Checked: ${new Date(s.checkedAt).toLocaleTimeString()}`,
        `Pending requests: ${s.totalPending} total, ${s.pendingOverdue} overdue`,
        `Lab results (24h): ${s.totalResults} total, ${s.abnormalCount} abnormal (${fmtRate(s.abnormalRate)})`,
        s.alertsFired.length > 0
          ? `Alerts: ${s.alertsFired.join(" | ")}`
          : "No alerts",
      ].join("\n");
      openldr.ui.showNotification(
        lines,
        s.alertsFired.length > 0 ? "warning" : "success",
      );
    },
  );

  openldr.ui.registerCommand(
    "labMonitor.clearAlerts",
    "Lab Monitor: Clear all alerts",
    () => {
      openldr.storage.set("alerts", []).catch(() => {});
      openldr.ui.showNotification("Alerts cleared", "info");
    },
  );

  openldr.ui.registerCommand(
    "labMonitor.togglePause",
    "Lab Monitor: Pause / Resume monitoring",
    () => {
      paused = !paused;
      if (paused) {
        if (checkTimer) clearTimeout(checkTimer);
        openldr.ui.statusBar.setText("🔬 ⏸ Paused", 20);
        openldr.ui.showNotification("Lab surveillance paused", "info");
      } else {
        openldr.ui.showNotification("Lab surveillance resumed", "info");
        runCheck();
      }
    },
  );
}

// ── Config loading ────────────────────────────────────────────────────────

async function loadConfig(): Promise<void> {
  try {
    const saved = await openldr.storage.get<Partial<MonitorConfig>>("config");
    if (saved && typeof saved === "object") {
      config = { ...DEFAULTS, ...saved };
    }
  } catch {
    config = { ...DEFAULTS };
  }
}

// ── Subscribe to config-change events ────────────────────────────────────

function listenForEvents(): void {
  // Another extension (or a future settings panel) can emit this
  // to hot-update the monitor's config without reinstalling it.
  openldr.events.on("monitor.configUpdate", (payload) => {
    const update = payload as Partial<MonitorConfig>;
    config = { ...config, ...update };
    openldr.storage.set("config", config).catch(() => {});
    openldr.ui.showNotification(
      `Lab Monitor config updated — interval: ${config.intervalMs / 1000}s`,
      "info",
    );
    if (checkTimer) clearTimeout(checkTimer);
    if (!paused) runCheck();
  });
}

// ── activate ── entry point called by WORKER_BOOTSTRAP ───────────────────

async function activate(sdk: OpenLDR.SDK): Promise<void> {
  // The bootstrap calls activate(openldr) — but since we're in a worker
  // the `openldr` global is already set before this function runs.
  // We accept it as a parameter for clarity and forward-compat.
  void sdk; // already available as global `openldr`

  openldr.ui.statusBar.setText("🔬 Starting…", 20);
  openldr.ui.showNotification("Lab Surveillance Monitor started", "info");

  await loadConfig();
  registerCommands();
  listenForEvents();

  // Run first check immediately, then on schedule
  await runCheck();
}

self.activate = activate;
