// ─────────────────────────────────────────────────────────────────────────────
// DISA Migration Tool — Step-by-step wizard UI
//
// Guides the user through:
//   1. Connect     — enter MSSQL credentials and set up FDW
//   2. Setup       — install core functions, foreign tables, and views
//   3. Materialize — copy dictionary tables locally for performance
//   4. Functions   — install composite migration functions
//   5. Migrate     — run the actual data migration
// ─────────────────────────────────────────────────────────────────────────────

// openldr SDK is injected by the host at runtime (see iframe-bridge.txt)
// Types are provided by openldr-sdk.d.ts

// ── Script groups (execution order) ─────────────────────────────────────────

const SETUP_SCRIPTS = [
  { id: "core_functions", label: "Core utility functions" },
  // DisaGlobal dictionaries
  { id: "parmdict", label: "PARMDICT (parameters)" },
  { id: "commdict", label: "COMMDICT (comments)" },
  { id: "testdict", label: "TESTDICT (tests)" },
  { id: "locndic4", label: "LOCNDIC4 (locations)" },
  { id: "systdic5", label: "SYSTDIC5 (systems)" },
  // DisalabDict dictionaries
  { id: "desldic5", label: "DESLDIC5 (destinations)" },
  { id: "ruledic5", label: "RULEDIC5 (rules)" },
  { id: "bregdict", label: "BREGDICT (registration)" },
  { id: "ordrdic5", label: "ORDRDIC5 (orders)" },
  { id: "wrkadict", label: "WRKADICT (workareas)" },
  { id: "doccdat5", label: "DOCCDAT5 (doctors)" },
  // DisalabData complex tables
  { id: "regdat4", label: "REGDAT4 (registrations)" },
  { id: "testdata", label: "TESTDATA (test results)" },
  { id: "txt1data", label: "TXT1DATA (text data)" },
  { id: "audtdata", label: "AUDTDATA (audit)" },
  { id: "hisdat5", label: "HISDAT5 (history)" },
  { id: "ordrdat5", label: "ORDRDAT5 (orders)" },
  { id: "printq4", label: "PRINTQ4 (print queue)" },
  { id: "stoadat5", label: "STOADAT5 (storage)" },
  { id: "wlstdat6", label: "WLSTDAT6 (worklists)" },
  // DisalabData index tables
  { id: "rdobidx4", label: "RDOBIDX4 (DOB index)" },
  { id: "rtknidx5", label: "RTKNIDX5 (token index)" },
  { id: "ridnidx4", label: "RIDNIDX4 (ID number index)" },
  { id: "rrefidx4", label: "RREFIDX4 (reference index)" },
  { id: "rdocidx4", label: "RDOCIDX4 (doctor index)" },
  { id: "rdnmidx4", label: "RDNMIDX4 (doctor name index)" },
  { id: "rnamidx4", label: "RNAMIDX4 (name index)" },
  { id: "rsnxidx4", label: "RSNXIDX4 (surname index)" },
  { id: "rlnkidx4", label: "RLNKIDX4 (link index)" },
  { id: "rlididx4", label: "RLIDIDX4 (LID index)" },
  { id: "rlnmidx4", label: "RLNMIDX4 (LNM index)" },
  { id: "rlsxidx4", label: "RLSXIDX4 (LSX index)" },
  { id: "rlocidx4", label: "RLOCIDX4 (location index)" },
  { id: "labndat4", label: "LABNDAT4 (lab number)" },
  { id: "lockdat5", label: "LOCKDAT5 (locks)" },
];

// ── State ───────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "complete" | "error";

interface WizardState {
  currentStep: number;
  steps: {
    status: StepStatus;
    error?: string;
    detail?: string;
  }[];
  // Connect form
  host: string;
  port: string;
  username: string;
  password: string;
  saveCredentials: boolean;
  // Setup progress
  setupProgress: number;
  setupTotal: number;
  setupCurrentScript: string;
  // Migration
  migrationRows: any[];
  migrationCount: number;
}

const state: WizardState = {
  currentStep: 0,
  steps: [
    { status: "pending" },
    { status: "pending" },
    { status: "pending" },
    { status: "pending" },
    { status: "pending" },
  ],
  host: "",
  port: "1433",
  username: "",
  password: "",
  saveCredentials: true,
  setupProgress: 0,
  setupTotal: SETUP_SCRIPTS.length,
  setupCurrentScript: "",
  migrationRows: [],
  migrationCount: 0,
};

const STEP_LABELS = [
  "Connect to MSSQL",
  "Setup Foreign Tables",
  "Materialize Dictionaries",
  "Install Migration Functions",
  "Run Migration",
];

// ── Styles ──────────────────────────────────────────────────────────────────

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #0f172a; color: #e2e8f0; padding: 24px; }
  .container { max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 24px; color: #f1f5f9; }

  /* Step indicator */
  .steps { display: flex; gap: 4px; margin-bottom: 32px; }
  .step-dot { flex: 1; height: 4px; border-radius: 2px; background: #334155; transition: background 0.3s; }
  .step-dot.active { background: #3b82f6; }
  .step-dot.complete { background: #22c55e; }
  .step-dot.error { background: #ef4444; }

  .step-nav { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
  .step-btn { padding: 8px 16px; border: 1px solid #334155; border-radius: 6px;
              background: #1e293b; color: #94a3b8; cursor: pointer; font-size: 13px;
              transition: all 0.2s; }
  .step-btn:hover { border-color: #475569; color: #e2e8f0; }
  .step-btn.active { border-color: #3b82f6; color: #3b82f6; background: #1e293b; }
  .step-btn.complete { border-color: #22c55e; color: #22c55e; }
  .step-btn.error { border-color: #ef4444; color: #ef4444; }

  /* Cards */
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px;
          padding: 24px; margin-bottom: 16px; }
  .card h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #f1f5f9; }
  .card p { font-size: 13px; color: #94a3b8; margin-bottom: 16px; line-height: 1.5; }

  /* Form */
  .form-row { display: flex; gap: 12px; margin-bottom: 12px; }
  .form-group { flex: 1; }
  .form-group label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
  .form-group input { width: 100%; padding: 8px 12px; border: 1px solid #334155;
                      border-radius: 6px; background: #0f172a; color: #e2e8f0;
                      font-size: 14px; outline: none; }
  .form-group input:focus { border-color: #3b82f6; }
  .checkbox-row { display: flex; align-items: center; gap: 8px; margin: 12px 0; }
  .checkbox-row input[type=checkbox] { accent-color: #3b82f6; }
  .checkbox-row label { font-size: 13px; color: #94a3b8; }

  /* Buttons */
  .btn { padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px;
         font-weight: 500; cursor: pointer; transition: all 0.2s; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-primary:hover { background: #2563eb; }
  .btn-primary:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
  .btn-secondary { background: #334155; color: #e2e8f0; }
  .btn-secondary:hover { background: #475569; }
  .btn-danger { background: #dc2626; color: white; }
  .btn-danger:hover { background: #b91c1c; }

  /* Progress */
  .progress-bar { width: 100%; height: 8px; background: #334155; border-radius: 4px;
                  overflow: hidden; margin: 12px 0; }
  .progress-fill { height: 100%; background: #3b82f6; border-radius: 4px;
                   transition: width 0.3s ease; }
  .progress-text { font-size: 12px; color: #64748b; margin-bottom: 4px; }

  /* Status badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px;
           font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge-pending { background: #334155; color: #94a3b8; }
  .badge-running { background: #1e3a5f; color: #60a5fa; }
  .badge-complete { background: #14532d; color: #4ade80; }
  .badge-error { background: #450a0a; color: #fca5a5; }

  /* Log */
  .log { background: #0f172a; border: 1px solid #334155; border-radius: 6px;
         padding: 12px; max-height: 200px; overflow-y: auto; font-family: monospace;
         font-size: 12px; line-height: 1.6; }
  .log-entry { color: #64748b; }
  .log-entry.success { color: #4ade80; }
  .log-entry.error { color: #fca5a5; }
  .log-entry.info { color: #60a5fa; }

  /* Results table */
  .results-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
  .results-table th { text-align: left; padding: 8px; border-bottom: 1px solid #334155;
                      color: #94a3b8; font-weight: 600; }
  .results-table td { padding: 8px; border-bottom: 1px solid #1e293b; color: #e2e8f0; }
  .results-table tr:hover td { background: #1e293b; }

  .actions { display: flex; gap: 8px; margin-top: 16px; }
`;

// ── DOM Helpers ─────────────────────────────────────────────────────────────

function h(
  tag: string,
  attrs: Record<string, any> = {},
  ...children: (string | HTMLElement)[]
): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") el.className = v;
    else if (k === "style" && typeof v === "object")
      Object.assign(el.style, v);
    else if (k.startsWith("on"))
      el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else if (c) el.appendChild(c);
  }
  return el;
}

function badge(status: StepStatus): HTMLElement {
  return h("span", { className: `badge badge-${status}` }, status);
}

// ── Log ─────────────────────────────────────────────────────────────────────

const logs: { msg: string; cls: string }[] = [];

function log(msg: string, cls = "") {
  logs.push({ msg, cls });
  renderLog();
}

function renderLog() {
  const el = document.getElementById("log");
  if (!el) return;
  el.innerHTML = "";
  for (const { msg, cls } of logs) {
    const div = document.createElement("div");
    div.className = `log-entry ${cls}`;
    div.textContent = msg;
    el.appendChild(div);
  }
  el.scrollTop = el.scrollHeight;
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function doConnect() {
  const { host, port, username, password, saveCredentials } = state;

  if (!host || !username || !password) {
    openldr.ui.showNotification("Please fill in all required fields", "warning");
    return;
  }

  state.steps[0].status = "running";
  state.steps[0].error = undefined;
  render();
  log("Connecting to MSSQL...", "info");

  try {
    // Save credentials if requested
    if (saveCredentials) {
      await openldr.credentials.save("mssql_fdw", { host, port, username, password });
      log("Credentials saved (encrypted)", "success");
    }

    // Run FDW setup script with parameters
    const result = await openldr.data.exec("fdw_setup", {
      host,
      port,
      username,
      password,
    });

    if (result.ok) {
      state.steps[0].status = "complete";
      state.steps[0].detail = `Connected in ${result.durationMs}ms`;
      log(`FDW setup complete (${result.durationMs}ms)`, "success");
      openldr.ui.showNotification("Connected to MSSQL successfully", "success");
    } else {
      throw new Error(result.error || "Unknown error");
    }
  } catch (err: any) {
    state.steps[0].status = "error";
    state.steps[0].error = err.message;
    log(`Connection failed: ${err.message}`, "error");
    openldr.ui.showNotification(`Connection failed: ${err.message}`, "error");
  }
  render();
}

async function doSetup() {
  state.steps[1].status = "running";
  state.steps[1].error = undefined;
  state.setupProgress = 0;
  render();
  log("Installing functions, foreign tables, and views...", "info");

  for (let i = 0; i < SETUP_SCRIPTS.length; i++) {
    const script = SETUP_SCRIPTS[i];
    state.setupProgress = i;
    state.setupCurrentScript = script.label;
    render();

    try {
      const result = await openldr.data.exec(script.id);
      log(`  [${i + 1}/${SETUP_SCRIPTS.length}] ${script.label} (${result.durationMs}ms)`, "success");
    } catch (err: any) {
      state.steps[1].status = "error";
      state.steps[1].error = `Failed at ${script.label}: ${err.message}`;
      log(`  FAILED: ${script.label} — ${err.message}`, "error");
      openldr.ui.showNotification(`Setup failed at ${script.label}`, "error");
      render();
      return;
    }
  }

  state.setupProgress = SETUP_SCRIPTS.length;
  state.steps[1].status = "complete";
  state.steps[1].detail = `${SETUP_SCRIPTS.length} scripts installed`;
  log(`Setup complete — ${SETUP_SCRIPTS.length} scripts installed`, "success");
  openldr.ui.showNotification("Setup complete", "success");
  render();
}

async function doMaterialize() {
  state.steps[2].status = "running";
  state.steps[2].error = undefined;
  render();
  log("Materializing dictionary tables...", "info");

  try {
    const result = await openldr.data.exec("materialize_dicts");
    state.steps[2].status = "complete";
    state.steps[2].detail = `Completed in ${result.durationMs}ms`;
    log(`Dictionaries materialized (${result.durationMs}ms)`, "success");
    openldr.ui.showNotification("Dictionaries materialized", "success");
  } catch (err: any) {
    state.steps[2].status = "error";
    state.steps[2].error = err.message;
    log(`Materialization failed: ${err.message}`, "error");
    openldr.ui.showNotification(`Materialization failed: ${err.message}`, "error");
  }
  render();
}

async function doInstallFunctions() {
  state.steps[3].status = "running";
  state.steps[3].error = undefined;
  render();
  log("Installing migration functions...", "info");

  try {
    const result = await openldr.data.exec("specimen_receipt");
    state.steps[3].status = "complete";
    state.steps[3].detail = `Installed in ${result.durationMs}ms`;
    log(`Migration functions installed (${result.durationMs}ms)`, "success");
    openldr.ui.showNotification("Migration functions ready", "success");
  } catch (err: any) {
    state.steps[3].status = "error";
    state.steps[3].error = err.message;
    log(`Function install failed: ${err.message}`, "error");
    openldr.ui.showNotification(`Install failed: ${err.message}`, "error");
  }
  render();
}

async function doMigrate() {
  state.steps[4].status = "running";
  state.steps[4].error = undefined;
  state.migrationRows = [];
  state.migrationCount = 0;
  render();
  log("Starting data migration...", "info");
  openldr.ui.statusBar.setText("Migration running...");

  try {
    // run_migration.sql inserts all rows into disa.migration_results
    // and returns a summary row (total_rows, earliest, latest, facility_count, unique_labs)
    const result = await openldr.data.exec("run_migration");
    const summary = result.rows?.[0] as any;
    const totalRows = summary?.total_rows ?? result.rowCount ?? 0;
    const durationSec = (result.durationMs / 1000).toFixed(1);

    state.migrationCount = totalRows;
    state.steps[4].detail = `${totalRows.toLocaleString()} rows migrated in ${durationSec}s`;

    if (summary) {
      log(`Migration summary:`, "info");
      log(`  Total rows: ${totalRows.toLocaleString()}`, "success");
      log(`  Date range: ${summary.earliest || "—"} to ${summary.latest || "—"}`, "info");
      log(`  Facilities: ${summary.facility_count ?? "—"}`, "info");
      log(`  Unique labs: ${summary.unique_labs ?? "—"}`, "info");
    }
    log(`Completed in ${durationSec}s`, "success");

    // Fetch a preview sample (50 rows)
    log("Loading preview...", "info");
    try {
      const preview = await openldr.data.exec("migration_preview");
      state.migrationRows = preview.rows || [];
      log(`Preview loaded: ${state.migrationRows.length} sample rows`, "success");
    } catch {
      log("Preview load failed (migration data is still saved)", "info");
    }

    state.steps[4].status = "complete";
    openldr.ui.showNotification(`Migration complete: ${totalRows.toLocaleString()} rows`, "success");
    openldr.ui.statusBar.setText(`Migration complete: ${totalRows.toLocaleString()} rows`);
  } catch (err: any) {
    state.steps[4].status = "error";
    state.steps[4].error = err.message;
    log(`Migration failed: ${err.message}`, "error");
    openldr.ui.showNotification(`Migration failed: ${err.message}`, "error");
    openldr.ui.statusBar.setText("Migration failed");
  }
  render();
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderStepContent(): HTMLElement {
  const step = state.currentStep;

  if (step === 0) {
    return h("div", { className: "card" },
      h("h2", {}, "Step 1: Connect to DISA*Lab MSSQL"),
      h("p", {}, "Enter the MSSQL server credentials for the DISA*Lab database. This will configure the PostgreSQL Foreign Data Wrapper (tds_fdw) to read data from MSSQL."),
      h("div", { className: "form-row" },
        h("div", { className: "form-group" },
          h("label", {}, "Host"),
          Object.assign(h("input", {
            type: "text",
            placeholder: "e.g. 192.168.1.100",
            value: state.host,
            onInput: (e: Event) => { state.host = (e.target as HTMLInputElement).value; },
          }) as HTMLInputElement, {}),
        ),
        h("div", { className: "form-group" },
          h("label", {}, "Port"),
          Object.assign(h("input", {
            type: "text",
            placeholder: "1433",
            value: state.port,
            onInput: (e: Event) => { state.port = (e.target as HTMLInputElement).value; },
          }) as HTMLInputElement, {}),
        ),
      ),
      h("div", { className: "form-row" },
        h("div", { className: "form-group" },
          h("label", {}, "Username"),
          Object.assign(h("input", {
            type: "text",
            placeholder: "sa",
            value: state.username,
            onInput: (e: Event) => { state.username = (e.target as HTMLInputElement).value; },
          }) as HTMLInputElement, {}),
        ),
        h("div", { className: "form-group" },
          h("label", {}, "Password"),
          Object.assign(h("input", {
            type: "password",
            placeholder: "••••••••",
            value: state.password,
            onInput: (e: Event) => { state.password = (e.target as HTMLInputElement).value; },
          }) as HTMLInputElement, {}),
        ),
      ),
      h("div", { className: "checkbox-row" },
        Object.assign(h("input", {
          type: "checkbox",
          id: "save-creds",
          ...(state.saveCredentials ? { checked: "" } : {}),
          onChange: (e: Event) => { state.saveCredentials = (e.target as HTMLInputElement).checked; },
        }) as HTMLInputElement, { checked: state.saveCredentials }),
        h("label", { for: "save-creds" }, "Save credentials (encrypted server-side)"),
      ),
      h("div", { className: "actions" },
        h("button", {
          className: "btn btn-primary",
          onClick: doConnect,
          ...(state.steps[0].status === "running" ? { disabled: "" } : {}),
        }, state.steps[0].status === "running" ? "Connecting..." : "Connect"),
      ),
      state.steps[0].error
        ? h("p", { style: { color: "#fca5a5", marginTop: "12px", fontSize: "13px" } }, state.steps[0].error)
        : h("span"),
    );
  }

  if (step === 1) {
    const pct = state.setupTotal > 0
      ? Math.round((state.setupProgress / state.setupTotal) * 100)
      : 0;

    return h("div", { className: "card" },
      h("h2", {}, "Step 2: Setup Foreign Tables & Views"),
      h("p", {}, `Install ${SETUP_SCRIPTS.length} scripts: core functions, dictionary tables, data tables, and index tables. This creates the PostgreSQL views that read from MSSQL via FDW.`),
      state.steps[1].status === "running"
        ? h("div", {},
            h("div", { className: "progress-text" }, `${state.setupProgress + 1}/${state.setupTotal}: ${state.setupCurrentScript}`),
            h("div", { className: "progress-bar" },
              h("div", { className: "progress-fill", style: { width: `${pct}%` } }),
            ),
          )
        : h("span"),
      h("div", { className: "actions" },
        h("button", {
          className: "btn btn-primary",
          onClick: doSetup,
          ...(state.steps[1].status === "running" ? { disabled: "" } : {}),
        }, state.steps[1].status === "running" ? "Installing..." : "Install All"),
      ),
      state.steps[1].error
        ? h("p", { style: { color: "#fca5a5", marginTop: "12px", fontSize: "13px" } }, state.steps[1].error)
        : h("span"),
    );
  }

  if (step === 2) {
    return h("div", { className: "card" },
      h("h2", {}, "Step 3: Materialize Dictionaries"),
      h("p", {}, "Copy dictionary tables from MSSQL to local PostgreSQL tables. This avoids FDW latency on frequently-accessed lookup data."),
      h("div", { className: "actions" },
        h("button", {
          className: "btn btn-primary",
          onClick: doMaterialize,
          ...(state.steps[2].status === "running" ? { disabled: "" } : {}),
        }, state.steps[2].status === "running" ? "Materializing..." : "Materialize Dictionaries"),
      ),
      state.steps[2].detail
        ? h("p", { style: { color: "#4ade80", marginTop: "12px", fontSize: "13px" } }, state.steps[2].detail)
        : h("span"),
      state.steps[2].error
        ? h("p", { style: { color: "#fca5a5", marginTop: "12px", fontSize: "13px" } }, state.steps[2].error)
        : h("span"),
    );
  }

  if (step === 3) {
    return h("div", { className: "card" },
      h("h2", {}, "Step 4: Install Migration Functions"),
      h("p", {}, "Install the composite specimen_receipt() and specimen_receipt_migrate() functions that extract and transform DISA*Lab data into OpenLDR format."),
      h("div", { className: "actions" },
        h("button", {
          className: "btn btn-primary",
          onClick: doInstallFunctions,
          ...(state.steps[3].status === "running" ? { disabled: "" } : {}),
        }, state.steps[3].status === "running" ? "Installing..." : "Install Functions"),
      ),
      state.steps[3].detail
        ? h("p", { style: { color: "#4ade80", marginTop: "12px", fontSize: "13px" } }, state.steps[3].detail)
        : h("span"),
      state.steps[3].error
        ? h("p", { style: { color: "#fca5a5", marginTop: "12px", fontSize: "13px" } }, state.steps[3].error)
        : h("span"),
    );
  }

  if (step === 4) {
    const rows = state.migrationRows;
    const cols = rows.length > 0 ? Object.keys(rows[0]).slice(0, 8) : [];

    return h("div", { className: "card" },
      h("h2", {}, "Step 5: Run Migration"),
      h("p", {}, "Execute the data migration. This calls disa.specimen_receipt_migrate() which pulls all registration, test, and audit data from DISA*Lab via FDW and returns normalized rows (~129K expected). A preview of the first 50 rows is shown below."),
      h("div", { className: "actions" },
        h("button", {
          className: "btn btn-primary",
          onClick: doMigrate,
          ...(state.steps[4].status === "running" ? { disabled: "" } : {}),
        }, state.steps[4].status === "running" ? "Migrating..." : "Start Migration"),
      ),
      state.steps[4].detail
        ? h("p", { style: { color: "#4ade80", marginTop: "12px", fontSize: "13px" } }, state.steps[4].detail)
        : h("span"),
      state.steps[4].error
        ? h("p", { style: { color: "#fca5a5", marginTop: "12px", fontSize: "13px" } }, state.steps[4].error)
        : h("span"),
      rows.length > 0
        ? h("div", { style: { overflowX: "auto", marginTop: "16px" } },
            h("table", { className: "results-table" },
              h("thead", {},
                h("tr", {}, ...cols.map(c => h("th", {}, c))),
              ),
              h("tbody", {},
                ...rows.slice(0, 20).map(row =>
                  h("tr", {}, ...cols.map(c =>
                    h("td", {}, String(row[c] ?? "—")),
                  )),
                ),
              ),
            ),
            rows.length > 0
              ? h("p", { style: { color: "#64748b", fontSize: "12px", marginTop: "8px" } },
                  `Showing ${Math.min(rows.length, 20)} of ${state.migrationCount.toLocaleString()} total rows (preview from disa.migration_results)`,
                )
              : h("span"),
          )
        : h("span"),
    );
  }

  return h("div", {}, "Unknown step");
}

function render() {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  // Step progress dots
  const dots = h("div", { className: "steps" },
    ...state.steps.map((s, i) => {
      let cls = "step-dot";
      if (i === state.currentStep) cls += " active";
      if (s.status === "complete") cls += " complete";
      if (s.status === "error") cls += " error";
      return h("div", { className: cls });
    }),
  );

  // Step navigation buttons
  const nav = h("div", { className: "step-nav" },
    ...STEP_LABELS.map((label, i) => {
      let cls = "step-btn";
      if (i === state.currentStep) cls += " active";
      if (state.steps[i].status === "complete") cls += " complete";
      if (state.steps[i].status === "error") cls += " error";
      return h("button", {
        className: cls,
        onClick: () => { state.currentStep = i; render(); },
      },
        `${i + 1}. ${label} `,
        badge(state.steps[i].status),
      );
    }),
  );

  // Log panel
  const logPanel = h("div", { className: "card", style: { marginTop: "16px" } },
    h("h2", {}, "Activity Log"),
    h("div", { id: "log", className: "log" }),
  );

  app.appendChild(h("div", { className: "container" },
    h("h1", {}, "DISA Migration Tool"),
    dots,
    nav,
    renderStepContent(),
    logPanel,
  ));

  renderLog();
}

// ── Init ────────────────────────────────────────────────────────────────────

async function init() {
  // Inject CSS
  const style = document.createElement("style");
  style.textContent = STYLES;
  document.head.appendChild(style);

  // Check for saved credentials
  try {
    const check = await openldr.credentials.check("mssql_fdw");
    if (check.exists) {
      const loaded = await openldr.credentials.load("mssql_fdw");
      if (loaded.exists && loaded.data) {
        state.host = loaded.data.host || "";
        state.port = loaded.data.port || "1433";
        state.username = loaded.data.username || "";
        state.password = loaded.data.password || "";
        log("Loaded saved credentials", "info");
      }
    }
  } catch {
    // No saved credentials — that's fine
  }

  render();
}

init();
