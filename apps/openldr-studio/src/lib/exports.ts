// import * as XLSX from "xlsx";

export type ExportRow = Record<
  string,
  string | number | boolean | null | undefined
>;

export function exportCSV(data: ExportRow[], filename: string): void {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data
    .map((r) =>
      Object.values(r)
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  download(
    new Blob([headers + "\n" + rows], { type: "text/csv" }),
    filename + ".csv",
  );
}

export function exportExcel(
  sheets: { name: string; data: ExportRow[] }[],
  filename: string,
): void {
  // try {
  //   const wb = XLSX.utils.book_new();
  //   sheets.forEach(({ name, data }) =>
  //     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name),
  //   );
  //   XLSX.writeFile(wb, filename + ".xlsx");
  // } catch {
  //   if (sheets[0]) exportCSV(sheets[0].data, filename);
  // }
}

export function exportTXT(data: ExportRow[], filename: string): void {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const widths = headers.map((h) =>
    Math.max(h.length, ...data.map((r) => String(r[h] ?? "").length)),
  );
  const fmt = (row: ExportRow) =>
    headers.map((h, i) => String(row[h] ?? "").padEnd(widths[i])).join("  |  ");
  const sep = widths.map((w) => "─".repeat(w)).join("──┼──");
  const headerRow: ExportRow = Object.fromEntries(headers.map((h) => [h, h]));
  const lines = [fmt(headerRow), sep, ...data.map(fmt)].join("\n");
  download(new Blob([lines], { type: "text/plain" }), filename + ".txt");
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(url);
}
