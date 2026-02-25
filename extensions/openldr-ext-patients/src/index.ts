// src/index.ts — Patient Statistics Extension
// Builds a patient demographics dashboard by querying openldr_external.patients
// via the openldr.data.query API.
//
// The `openldr` global is injected by the host bridge before this code runs.

interface Patient {
  id: number;
  patient_id?: string;
  gender?: string;
  date_of_birth?: string;
  created_at?: string;
  status?: string;
  facility_id?: number;
  [key: string]: unknown;
}

interface Stats {
  total: number;
  male: number;
  female: number;
  other: number;
  ageGroups: Record<string, number>;
  monthlyTrend: Array<{ month: string; count: number }>;
  statusBreakdown: Record<string, number>;
}

// ── DOM refs ──────────────────────────────────────────────────────────────

let refreshBtn: HTMLButtonElement | null = null;
let isLoading = false;

// ── Helpers ───────────────────────────────────────────────────────────────

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function ageGroup(age: number | null): string {
  if (age === null) return "Unknown";
  if (age < 5) return "0–4";
  if (age < 18) return "5–17";
  if (age < 35) return "18–34";
  if (age < 50) return "35–49";
  if (age < 65) return "50–64";
  return "65+";
}

function monthKey(dateStr: string): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function computeStats(patients: Patient[]): Stats {
  const stats: Stats = {
    total: patients.length,
    male: 0,
    female: 0,
    other: 0,
    ageGroups: {},
    monthlyTrend: [],
    statusBreakdown: {},
  };

  const monthMap = new Map<string, number>();
  const statusMap = new Map<string, number>();

  for (const p of patients) {
    // Gender
    const g = (p.gender || "").toLowerCase();
    if (g === "m" || g === "male") stats.male++;
    else if (g === "f" || g === "female") stats.female++;
    else stats.other++;

    // Age group
    const ag = ageGroup(ageFromDob(p.date_of_birth as string));
    stats.ageGroups[ag] = (stats.ageGroups[ag] || 0) + 1;

    // Monthly trend
    const mk = monthKey((p.created_at || p.registration_date || "") as string);
    monthMap.set(mk, (monthMap.get(mk) || 0) + 1);

    // Status
    const st = (p.status || "unknown") as string;
    statusMap.set(st, (statusMap.get(st) || 0) + 1);
  }

  stats.monthlyTrend = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  stats.statusBreakdown = Object.fromEntries(statusMap);

  return stats;
}

// ── Chart renderers ───────────────────────────────────────────────────────

function renderBar(
  container: HTMLElement,
  label: string,
  value: number,
  max: number,
  colour: string,
) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;align-items:center;gap:8px;margin-bottom:6px";
  row.innerHTML = `
    <span style="width:56px;font-size:10px;color:#475569;text-align:right;flex-shrink:0">${label}</span>
    <div style="flex:1;height:14px;background:#0d0f16;border-radius:3px;overflow:hidden">
      <div style="width:${pct.toFixed(1)}%;height:100%;background:${colour};border-radius:3px;transition:width 0.4s ease"></div>
    </div>
    <span style="width:36px;font-size:10px;color:#94a3b8;text-align:right;flex-shrink:0">${value.toLocaleString()}</span>
  `;
  container.appendChild(row);
}

function renderTrendSparkline(
  container: HTMLElement,
  trend: Array<{ month: string; count: number }>,
) {
  if (trend.length === 0) {
    container.innerHTML =
      '<span style="color:#2d3652;font-size:10px">No trend data</span>';
    return;
  }
  const maxVal = Math.max(...trend.map((t) => t.count), 1);
  const w = 480,
    h = 80,
    pad = 8;

  const pts = trend.map((t, i) => {
    const x = pad + (i / Math.max(trend.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (t.count / maxVal) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.style.cssText = "width:100%;height:80px";

  // Area fill
  const areaPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  const firstX = parseFloat(pts[0].split(",")[0]);
  const lastX = parseFloat(pts[pts.length - 1].split(",")[0]);
  areaPath.setAttribute(
    "d",
    `M${firstX},${h - pad} L${pts.join(" L")} L${lastX},${h - pad} Z`,
  );
  areaPath.setAttribute("fill", "#f59e0b22");
  svg.appendChild(areaPath);

  // Line
  const line = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline",
  );
  line.setAttribute("points", pts.join(" "));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#f59e0b");
  line.setAttribute("stroke-width", "1.5");
  line.setAttribute("stroke-linejoin", "round");
  svg.appendChild(line);

  // Month labels
  trend.forEach((t, i) => {
    if (i % Math.ceil(trend.length / 6) !== 0 && i !== trend.length - 1) return;
    const x = pad + (i / Math.max(trend.length - 1, 1)) * (w - pad * 2);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x.toFixed(1));
    text.setAttribute("y", `${h}`);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "#2d3652");
    text.setAttribute("font-size", "9");
    text.setAttribute("font-family", "monospace");
    text.textContent = t.month.slice(5); // MM
    svg.appendChild(text);
  });

  container.appendChild(svg);
}

// ── Render UI ─────────────────────────────────────────────────────────────

function renderStats(stats: Stats) {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  // Header
  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;margin-bottom:16px";
  header.innerHTML = `
    <div>
      <h1 style="font-size:14px;font-weight:600;color:#e2e8f0">Patient Statistics</h1>
      <p style="font-size:10px;color:#475569;font-family:monospace;margin-top:2px">openldr_external.patients · ${stats.total.toLocaleString()} total records</p>
    </div>
  `;
  refreshBtn = document.createElement("button");
  refreshBtn.textContent = "↺ Refresh";
  refreshBtn.style.cssText =
    "background:#1e2232;border:1px solid #2d3652;color:#94a3b8;font-size:10px;font-family:monospace;padding:4px 10px;border-radius:6px;cursor:pointer";
  refreshBtn.onclick = () => loadData();
  header.appendChild(refreshBtn);
  app.appendChild(header);

  // KPI row
  const kpi = document.createElement("div");
  kpi.style.cssText =
    "display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px";
  const kpis = [
    {
      label: "Total Patients",
      value: stats.total.toLocaleString(),
      colour: "#f59e0b",
    },
    { label: "Male", value: stats.male.toLocaleString(), colour: "#2dd4bf" },
    {
      label: "Female",
      value: stats.female.toLocaleString(),
      colour: "#a78bfa",
    },
    {
      label: "Other / Unknown",
      value: stats.other.toLocaleString(),
      colour: "#475569",
    },
  ];
  for (const k of kpis) {
    const card = document.createElement("div");
    card.style.cssText = `background:#0d0f16;border:1px solid #1e2232;border-radius:8px;padding:10px`;
    card.innerHTML = `
      <p style="font-size:9px;color:#475569;font-family:monospace;margin-bottom:4px">${k.label}</p>
      <p style="font-size:18px;font-weight:700;color:${k.colour};font-family:monospace">${k.value}</p>
    `;
    kpi.appendChild(card);
  }
  app.appendChild(kpi);

  // Two-column: age groups + status
  const cols = document.createElement("div");
  cols.style.cssText =
    "display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px";

  // Age groups
  const ageCard = document.createElement("div");
  ageCard.style.cssText =
    "background:#0d0f16;border:1px solid #1e2232;border-radius:8px;padding:12px";
  ageCard.innerHTML =
    '<p style="font-size:9px;color:#475569;font-family:monospace;margin-bottom:10px">AGE DISTRIBUTION</p>';
  const ageGroups = [
    "0–4",
    "5–17",
    "18–34",
    "35–49",
    "50–64",
    "65+",
    "Unknown",
  ];
  const ageMax = Math.max(...ageGroups.map((g) => stats.ageGroups[g] || 0), 1);
  const ageColours = [
    "#34d399",
    "#2dd4bf",
    "#60a5fa",
    "#a78bfa",
    "#f59e0b",
    "#f87171",
    "#475569",
  ];
  ageGroups.forEach((g, i) =>
    renderBar(ageCard, g, stats.ageGroups[g] || 0, ageMax, ageColours[i]),
  );
  cols.appendChild(ageCard);

  // Status
  const statusCard = document.createElement("div");
  statusCard.style.cssText =
    "background:#0d0f16;border:1px solid #1e2232;border-radius:8px;padding:12px";
  statusCard.innerHTML =
    '<p style="font-size:9px;color:#475569;font-family:monospace;margin-bottom:10px">STATUS BREAKDOWN</p>';
  const statuses = Object.entries(stats.statusBreakdown).sort(
    ([, a], [, b]) => b - a,
  );
  const statusMax = statuses[0]?.[1] || 1;
  const statusColours = [
    "#34d399",
    "#f59e0b",
    "#f87171",
    "#a78bfa",
    "#60a5fa",
    "#2dd4bf",
  ];
  statuses.forEach(([s, c], i) =>
    renderBar(
      statusCard,
      s,
      c,
      statusMax,
      statusColours[i % statusColours.length],
    ),
  );
  if (statuses.length === 0)
    statusCard.innerHTML +=
      '<p style="font-size:10px;color:#2d3652">No status data</p>';
  cols.appendChild(statusCard);

  app.appendChild(cols);

  // Trend
  const trendCard = document.createElement("div");
  trendCard.style.cssText =
    "background:#0d0f16;border:1px solid #1e2232;border-radius:8px;padding:12px";
  trendCard.innerHTML =
    '<p style="font-size:9px;color:#475569;font-family:monospace;margin-bottom:8px">REGISTRATION TREND (last 12 months)</p>';
  renderTrendSparkline(trendCard, stats.monthlyTrend);
  app.appendChild(trendCard);
}

function renderLoading() {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px">
      <div style="width:24px;height:24px;border:2px solid #1e2232;border-top-color:#f59e0b;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <p style="font-size:11px;color:#475569;font-family:monospace">Loading patient data…</p>
    </div>
  `;
}

function renderError(msg: string) {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:10px">
      <p style="font-size:20px">⚠️</p>
      <p style="font-size:12px;color:#f87171;font-family:monospace">Failed to load data</p>
      <p style="font-size:10px;color:#475569;font-family:monospace;max-width:320px;text-align:center">${msg}</p>
      <button onclick="loadData()" style="margin-top:8px;background:#1e2232;border:1px solid #2d3652;color:#94a3b8;font-size:10px;font-family:monospace;padding:4px 12px;border-radius:6px;cursor:pointer">↺ Retry</button>
    </div>
  `;
}

// ── Data loading ──────────────────────────────────────────────────────────

async function loadData() {
  if (isLoading) return;
  isLoading = true;
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "↺ Loading…";
  }

  renderLoading();

  try {
    let allPatients: Patient[] = [];
    let page = 1;
    const limit = 500;

    // Paginate until we have all patients (up to 5000)
    while (allPatients.length < 5000) {
      const result = await openldr.data.query<Patient>("external", "patients", {
        page,
        limit,
        sort: { field: "created_at", direction: "desc" },
      });

      allPatients = [...allPatients, ...result.data];

      if (result.data.length < limit || allPatients.length >= result.total)
        break;
      page++;
    }

    openldr.ui.statusBar.setText(
      `🏥 ${allPatients.length.toLocaleString()} patients`,
      10,
    );
    // openldr.ui.showNotification(`Loaded ${allPatients.length.toLocaleString()} patients`, 'success')

    const stats = computeStats(allPatients);
    renderStats(stats);

    // Persist last-loaded timestamp
    await openldr.storage.set("lastLoaded", new Date().toISOString());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    openldr.ui.showNotification(`Patient stats error: ${msg}`, "error");
    renderError(msg);
  } finally {
    isLoading = false;
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "↺ Refresh";
    }
  }
}

// ── Activation ────────────────────────────────────────────────────────────

// Register refresh command in the command palette
openldr.ui.registerCommand(
  "patients.refresh",
  "Patient Stats: Refresh Data",
  () => loadData(),
);

// Subscribe to refresh events from other extensions
openldr.events.on("data.refresh", () => loadData());

// Initial load
loadData();
