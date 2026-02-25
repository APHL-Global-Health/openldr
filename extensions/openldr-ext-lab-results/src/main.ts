// src/main.ts — Lab Results Browser Extension
// Queries openldr_external.lab_results with filters, pagination, and CSV export.

interface LabResult {
  id: number;
  result_id?: string;
  request_id?: number | string;
  test_name?: string;
  test_code?: string;
  result_value?: string | number;
  result_unit?: string;
  reference_range?: string;
  status?: string;
  interpretation?: string;
  collected_at?: string;
  resulted_at?: string;
  facility_id?: number;
  [key: string]: unknown;
}

// ── State ─────────────────────────────────────────────────────────────────

const state = {
  results: [] as LabResult[],
  total: 0,
  page: 1,
  limit: 50,
  loading: false,
  filterStatus: "" as string,
  filterTest: "" as string,
  sortField: "resulted_at",
  sortDir: "desc" as "asc" | "desc",
};

// ── DOM helpers ───────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: string,
  html = "",
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = style;
  if (html) e.innerHTML = html;
  return e;
}

function $<T extends Element>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function interpretColour(interp: string): string {
  const i = (interp || "").toLowerCase();
  if (i.includes("high") || i.includes("above") || i.includes("positive"))
    return "#f87171";
  if (i.includes("low") || i.includes("below")) return "#60a5fa";
  if (i.includes("norm") || i.includes("negative")) return "#34d399";
  return "#475569";
}

function statusColour(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "final" || s === "complete") return "#34d399";
  if (s === "preliminary" || s === "partial") return "#f59e0b";
  if (s === "cancelled") return "#f87171";
  return "#475569";
}

function formatDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function exportCsv() {
  if (state.results.length === 0) return;
  const keys = Object.keys(state.results[0]).filter((k) => !k.startsWith("_"));
  const rows = [
    keys.join(","),
    ...state.results.map((r) =>
      keys.map((k) => JSON.stringify(r[k] ?? "")).join(","),
    ),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lab-results-page${state.page}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  openldr.ui.showNotification(
    `Exported ${state.results.length} rows as CSV`,
    "success",
  );
}

// ── Render ────────────────────────────────────────────────────────────────

function buildUI() {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  // ── Toolbar ────────────────────────────────────────────────────────────
  const toolbar = el(
    "div",
    "display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap",
  );

  const title = el(
    "span",
    "font-size:13px;font-weight:600;color:var(--bright);margin-right:4px",
  );
  title.textContent = "Lab Results";

  const totalBadge = el(
    "span",
    "font-size:9px;font-family:monospace;color:var(--muted);padding:2px 6px;background:var(--surface);border:1px solid var(--border);border-radius:10px",
    `<span id="total-count">—</span> results`,
  );

  // Status filter
  const statusFilter = el(
    "select",
    "background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;font-family:monospace;padding:4px 6px;border-radius:5px;cursor:pointer;margin-left:auto",
  );
  [
    ["", "All statuses"],
    ["final", "Final"],
    ["preliminary", "Preliminary"],
    ["cancelled", "Cancelled"],
  ].forEach(([v, l]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = l;
    statusFilter.appendChild(o);
  });
  statusFilter.value = state.filterStatus;
  statusFilter.onchange = () => {
    state.filterStatus = statusFilter.value;
    state.page = 1;
    loadData();
  };

  // Test filter
  const testInput = el(
    "input",
    "background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;font-family:monospace;padding:4px 8px;border-radius:5px;width:120px",
  ) as HTMLInputElement;
  testInput.placeholder = "Filter test…";
  testInput.value = state.filterTest;
  let debounce: ReturnType<typeof setTimeout>;
  testInput.oninput = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.filterTest = testInput.value;
      state.page = 1;
      loadData();
    }, 400);
  };

  // Refresh
  const refreshBtnEl = el(
    "button",
    "background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;font-family:monospace;padding:4px 10px;border-radius:5px;cursor:pointer",
  ) as HTMLButtonElement;
  refreshBtnEl.id = "refresh-btn";
  refreshBtnEl.textContent = "↺";
  refreshBtnEl.title = "Refresh";
  refreshBtnEl.onclick = () => {
    state.page = 1;
    loadData();
  };

  // CSV export
  const exportBtn = el(
    "button",
    "background:var(--surface);border:1px solid var(--border);color:var(--teal);font-size:10px;font-family:monospace;padding:4px 10px;border-radius:5px;cursor:pointer",
  );
  exportBtn.textContent = "⬇ CSV";
  exportBtn.onclick = exportCsv;

  toolbar.append(
    title,
    totalBadge,
    statusFilter,
    testInput,
    refreshBtnEl,
    exportBtn,
  );
  app.appendChild(toolbar);

  // ── Table ──────────────────────────────────────────────────────────────
  const tableWrap = el("div", "flex:1;overflow:auto");
  tableWrap.id = "table-wrap";
  app.appendChild(tableWrap);

  // ── Pagination ─────────────────────────────────────────────────────────
  const pager = el(
    "div",
    "display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-top:1px solid var(--border);flex-shrink:0",
  );
  pager.id = "pager";
  app.appendChild(pager);
}

function renderTable(results: LabResult[]) {
  const wrap = document.getElementById("table-wrap")!;
  wrap.innerHTML = "";

  if (results.length === 0) {
    wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:120px;color:var(--subtle);font-size:11px">No results found</div>`;
    return;
  }

  const cols: Array<{ key: keyof LabResult; label: string; width: string }> = [
    { key: "result_id", label: "Result ID", width: "90px" },
    { key: "test_name", label: "Test", width: "140px" },
    { key: "result_value", label: "Value", width: "70px" },
    { key: "result_unit", label: "Unit", width: "60px" },
    { key: "reference_range", label: "Ref Range", width: "90px" },
    { key: "interpretation", label: "Interp.", width: "70px" },
    { key: "status", label: "Status", width: "80px" },
    { key: "resulted_at", label: "Date", width: "90px" },
    { key: "facility_id", label: "Facility", width: "60px" },
  ];

  const table = el(
    "table",
    "width:100%;border-collapse:collapse;table-layout:fixed",
  );

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.style.cssText =
    "background:var(--surface);position:sticky;top:0;z-index:1";

  cols.forEach((col) => {
    const th = document.createElement("th");
    th.style.cssText = `width:${col.width};padding:5px 8px;text-align:left;font-size:9px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap;cursor:pointer`;
    th.textContent =
      col.label +
      (state.sortField === col.key
        ? state.sortDir === "asc"
          ? " ↑"
          : " ↓"
        : "");
    th.onclick = () => {
      if (state.sortField === col.key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortField = col.key as string;
        state.sortDir = "desc";
      }
      state.page = 1;
      loadData();
    };
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  results.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.style.cssText = `background:${i % 2 === 0 ? "transparent" : "var(--surface)"};border-bottom:1px solid #0d0f16`;

    cols.forEach((col) => {
      const td = document.createElement("td");
      td.style.cssText =
        "padding:5px 8px;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

      const val = row[col.key];

      if (col.key === "interpretation" && val) {
        td.style.color = interpretColour(val as string);
        td.textContent = val as string;
      } else if (col.key === "status" && val) {
        const badge = el(
          "span",
          `font-size:9px;padding:1px 5px;border-radius:3px;background:${statusColour(val as string)}22;color:${statusColour(val as string)};border:1px solid ${statusColour(val as string)}44`,
        );
        badge.textContent = val as string;
        td.appendChild(badge);
      } else if (col.key === "resulted_at" || col.key === "collected_at") {
        td.style.color = "var(--muted)";
        td.textContent = formatDate(val as string);
      } else if (col.key === "result_value") {
        td.style.color = "var(--bright)";
        td.style.fontWeight = "600";
        td.textContent = val != null ? String(val) : "—";
      } else {
        td.style.color = "var(--text)";
        td.textContent = val != null ? String(val) : "—";
      }

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
}

function renderPager() {
  const pager = document.getElementById("pager")!;
  const totalPages = Math.ceil(state.total / state.limit) || 1;

  pager.innerHTML = "";

  const info = el(
    "span",
    "font-size:10px;color:var(--muted);font-family:monospace",
    `Page ${state.page} of ${totalPages} · ${state.total.toLocaleString()} rows`,
  );

  const prevBtn = el(
    "button",
    `background:var(--surface);border:1px solid var(--border);color:${state.page <= 1 ? "var(--subtle)" : "var(--text)"};font-size:10px;font-family:monospace;padding:3px 10px;border-radius:5px;cursor:${state.page <= 1 ? "not-allowed" : "pointer"}`,
  ) as HTMLButtonElement;
  prevBtn.textContent = "← Prev";
  prevBtn.disabled = state.page <= 1;
  prevBtn.onclick = () => {
    if (state.page > 1) {
      state.page--;
      loadData();
    }
  };

  const nextBtn = el(
    "button",
    `background:var(--surface);border:1px solid var(--border);color:${state.page >= totalPages ? "var(--subtle)" : "var(--text)"};font-size:10px;font-family:monospace;padding:3px 10px;border-radius:5px;cursor:${state.page >= totalPages ? "not-allowed" : "pointer"}`,
  ) as HTMLButtonElement;
  nextBtn.textContent = "Next →";
  nextBtn.disabled = state.page >= totalPages;
  nextBtn.onclick = () => {
    if (state.page < totalPages) {
      state.page++;
      loadData();
    }
  };

  const btnGroup = el("div", "display:flex;gap:6px");
  btnGroup.append(prevBtn, nextBtn);
  pager.append(info, btnGroup);
}

// ── Data loading ──────────────────────────────────────────────────────────

async function loadData() {
  if (state.loading) return;
  state.loading = true;

  const btn = document.getElementById(
    "refresh-btn",
  ) as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "…";
  }

  const tableWrap = document.getElementById("table-wrap");
  if (tableWrap) {
    tableWrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:80px;gap:10px;color:var(--muted)"><span style="animation:spin 0.8s linear infinite;display:inline-block">↺</span> Loading…</div>`;
  }

  try {
    const filters: Record<string, unknown> = {};
    if (state.filterStatus) filters["status"] = state.filterStatus;
    if (state.filterTest) filters["test_name"] = state.filterTest;

    const result = await openldr.data.query<LabResult>(
      "external",
      "lab_results",
      {
        filters,
        page: state.page,
        limit: state.limit,
        sort: { field: state.sortField, direction: state.sortDir },
      },
    );

    state.results = result.data;
    state.total = result.total;

    const countEl = document.getElementById("total-count");
    if (countEl) countEl.textContent = result.total.toLocaleString();

    openldr.ui.statusBar.setText(
      `🧪 ${result.total.toLocaleString()} results`,
      5,
    );

    renderTable(state.results);
    renderPager();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    openldr.ui.showNotification(`Lab results error: ${msg}`, "error");
    const wrap = document.getElementById("table-wrap");
    if (wrap)
      wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:120px;flex-direction:column;gap:8px"><p style="color:var(--red);font-size:11px">Failed to load</p><p style="color:var(--muted);font-size:10px;max-width:300px;text-align:center">${msg}</p></div>`;
  } finally {
    state.loading = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "↺";
    }
  }
}

// ── Activation ────────────────────────────────────────────────────────────

openldr.ui.registerCommand("labResults.refresh", "Lab Results: Refresh", () => {
  state.page = 1;
  loadData();
});
openldr.ui.registerCommand(
  "labResults.exportCsv",
  "Lab Results: Export as CSV",
  () => exportCsv(),
);

openldr.events.on("data.refresh", () => {
  state.page = 1;
  loadData();
});

buildUI();
loadData();
