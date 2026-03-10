import { useState } from "react";

// ── JSON Tree viewer ──────────────────────────────────────────────────────────
export function JsonTree({
  data,
  depth = 0,
}: {
  data: unknown;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (data === null) return <span className="text-slate-500">null</span>;
  if (typeof data === "boolean")
    return <span className="">{String(data)}</span>;
  if (typeof data === "number") return <span className="">{data}</span>;
  if (typeof data === "string") return <span className="">"{data}"</span>;

  const isArray = Array.isArray(data);
  const entries = Object.entries(data as Record<string, unknown>);

  return (
    <span>
      <span className="text-slate-400">{isArray ? "[" : "{"}</span>
      {entries.map(([k, v], i) => {
        const isObj = v !== null && typeof v === "object";
        const isCol = collapsed[k];
        return (
          <div key={k} style={{ paddingLeft: 14 }}>
            <span
              className={` ${isObj ? "cursor-pointer select-none" : ""}`}
              onClick={() =>
                isObj && setCollapsed((c) => ({ ...c, [k]: !c[k] }))
              }
            >
              {isObj && (
                <span className="mr-1 text-slate-600 text-[9px]">
                  {isCol ? "▶" : "▼"}
                </span>
              )}
              {isArray ? "" : `"${k}"`}
            </span>
            {!isArray && <span className="text-slate-600">: </span>}
            {isObj && isCol ? (
              <span className="text-slate-600">
                {Array.isArray(v) ? "[…]" : "{…}"}
              </span>
            ) : (
              <JsonTree data={v} depth={depth + 1} />
            )}
            {i < entries.length - 1 && (
              <span className="text-slate-600">,</span>
            )}
          </div>
        );
      })}
      <span className="text-slate-400">{isArray ? "]" : "}"}</span>
    </span>
  );
}
