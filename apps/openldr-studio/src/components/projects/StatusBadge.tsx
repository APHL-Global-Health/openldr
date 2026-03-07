// ── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/30",
    draft: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    inactive: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };
  return (
    <span
      className={`rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest ${
        cls[status] ?? cls.inactive
      }`}
    >
      {status}
    </span>
  );
}
