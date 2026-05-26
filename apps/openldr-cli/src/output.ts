import { inspect } from "node:util";

export type OutputFormat = "ndjson" | "json" | "pretty" | "table";

export function isValidFormat(value: string): value is OutputFormat {
  return value === "ndjson" || value === "json" || value === "pretty" || value === "table";
}

export interface OutputOptions {
  format: OutputFormat;
  color: boolean;
  fields?: string[];
}

export function project<T extends Record<string, unknown>>(
  obj: T,
  fields: string[] | undefined,
): Record<string, unknown> {
  if (fields === undefined || fields.length === 0) return obj;
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in obj) out[f] = obj[f];
  return out;
}

function serialize(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Buffer) return v.toString("base64");
    return v;
  });
}

export function emitRow(
  value: Record<string, unknown>,
  opts: OutputOptions,
  arrayAccumulator?: Record<string, unknown>[],
): void {
  const projected = project(value, opts.fields);
  if (opts.format === "ndjson") {
    process.stdout.write(serialize(projected) + "\n");
    return;
  }
  if (opts.format === "json") {
    arrayAccumulator?.push(projected);
    return;
  }
  if (opts.format === "table") {
    arrayAccumulator?.push(projected);
    return;
  }
  process.stdout.write(inspect(projected, { colors: opts.color, depth: 6, breakLength: 100 }) + "\n");
}

export function emitArray(values: Record<string, unknown>[], opts: OutputOptions): void {
  if (opts.format === "json") {
    process.stdout.write(JSON.stringify(values.map((v) => project(v, opts.fields))) + "\n");
    return;
  }
  if (opts.format === "table") {
    const rows = values.map((v) => project(v, opts.fields));
    if (rows.length === 0) {
      process.stdout.write("(empty)\n");
      return;
    }
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const widths = cols.map((c) =>
      Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)),
    );
    const fmt = (cells: string[]) =>
      cells.map((c, i) => c.padEnd(widths[i] ?? c.length)).join("  ");
    process.stdout.write(fmt(cols) + "\n");
    process.stdout.write(fmt(widths.map((w) => "-".repeat(w))) + "\n");
    for (const r of rows) {
      process.stdout.write(fmt(cols.map((c) => String(r[c] ?? ""))) + "\n");
    }
    return;
  }
  for (const v of values) emitRow(v, opts);
}

export function emitMeta(obj: Record<string, unknown>): void {
  process.stderr.write(JSON.stringify(obj) + "\n");
}

export function emitText(text: string): void {
  process.stdout.write(text.endsWith("\n") ? text : text + "\n");
}
