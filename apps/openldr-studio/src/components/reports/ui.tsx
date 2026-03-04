import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

// ── Design tokens ─────────────────────────────────────────────
export const C = {
  bg: "#04080F",
  surface: "#080E1A",
  card: "#0C1422",
  border: "#14243A",
  borderAccent: "#1C3050",
  text: "#C8DCF0",
  textMuted: "#3E6080",
  textDim: "#1E3A58",
  accent: "#00C9A7",
  accentDim: "rgba(0,201,167,0.12)",
  accentBlue: "#2D9EFF",
  critical: "#FF4560",
  high: "#FF7A45",
  warning: "#FFC145",
  success: "#00E396",
  grid: "#0A1828",
  purple: "#7B61FF",
} as const;

export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #04080F; }
  ::-webkit-scrollbar-thumb { background: #14243A; border-radius: 3px; }
  .hcell { transition: transform .15s, box-shadow .15s; cursor: default; }
  .hcell:hover { transform: scale(1.08); z-index: 10; box-shadow: 0 0 14px rgba(0,201,167,.35); }
  .navi { transition: all .2s; cursor: pointer; border: none; }
  .navi:hover { background: rgba(0,201,167,.07) !important; }
  .navi.on { background: rgba(0,201,167,.11) !important; }
  tr.hr:hover td { background: #0F1828 !important; }
  .exbtn { transition: all .15s; }
  .exbtn:hover { border-color: #00C9A7 !important; color: #00C9A7 !important; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }
  @media print { .noprint { display: none !important; } body { background: #fff; } }
`;

// ── Color helpers ─────────────────────────────────────────────
export function resColor(pct: number | null | undefined): string {
  if (pct == null) return "#0C1422";
  if (pct >= 80) return "#FF4560";
  if (pct >= 60) return "#FF6B45";
  if (pct >= 40) return "#FF9B35";
  if (pct >= 20) return "#FFC145";
  if (pct >= 5) return "#6DD877";
  return "#00E396";
}

// ── Badge ─────────────────────────────────────────────────────
export type BadgeVariant = "critical" | "high" | "medium" | "low" | "default";

interface BadgeProps {
  children: React.ReactNode;
  v?: BadgeVariant;
}
export function Badge({ children, v = "default" }: BadgeProps) {
  const map: Record<BadgeVariant, { bg: string; c: string; b: string }> = {
    critical: {
      bg: "rgba(255,69,96,.14)",
      c: "#FF4560",
      b: "rgba(255,69,96,.3)",
    },
    high: {
      bg: "rgba(255,122,69,.14)",
      c: "#FF7A45",
      b: "rgba(255,122,69,.3)",
    },
    medium: {
      bg: "rgba(255,193,69,.14)",
      c: "#FFC145",
      b: "rgba(255,193,69,.3)",
    },
    low: { bg: "rgba(0,227,150,.1)", c: "#00E396", b: "rgba(0,227,150,.3)" },
    default: {
      bg: "rgba(45,158,255,.1)",
      c: "#2D9EFF",
      b: "rgba(45,158,255,.3)",
    },
  };
  const s = map[v];
  return (
    <span
      style={{
        background: s.bg,
        color: s.c,
        border: `1px solid ${s.b}`,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".07em",
        textTransform: "uppercase",
        fontFamily: "'IBM Plex Mono',monospace",
      }}
    >
      {children}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────
interface StatProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  Icon?: LucideIcon;
  trend?: number;
}
export function Stat({ label, value, sub, color, Icon, trend }: StatProps) {
  return (
    <div className="flex flex-col gap-1.5 bg-secondary border-border rounded-lg px-4 py-3 shadow">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: ".09em",
            textTransform: "uppercase",
            fontFamily: "'IBM Plex Mono',monospace",
          }}
        >
          {label}
        </span>
        {Icon && <Icon size={13} color={color ?? C.textMuted} />}
      </div>
      <div
        style={{
          color: color ?? C.text,
          fontSize: 26,
          fontWeight: 700,
          fontFamily: "'Sora',sans-serif",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            fontFamily: "'IBM Plex Mono',monospace",
          }}
        >
          {sub}
        </div>
      )}
      {trend !== undefined && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: trend > 0 ? C.critical : C.success,
            fontFamily: "'IBM Plex Mono',monospace",
          }}
        >
          {/* {trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} */}
          {trend > 0 ? "+" : ""}
          {trend}% vs prev. period
        </div>
      )}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────
interface HeadProps {
  title: string;
  subtitle?: string;
  meta?: string;
}
export function Head({ title, subtitle, meta }: HeadProps) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* <h2
          style={{
            color: C.text,
            fontSize: 21,
            fontWeight: 700,
            fontFamily: "'Sora',sans-serif",
            margin: 0,
            letterSpacing: "-.02em",
          }}
        >
          {title}
        </h2> */}
        {meta && <span className="text-[11px]">{meta}</span>}
      </div>
      {subtitle && <p className="mt-1.5 text-[12px]">{subtitle}</p>}
    </div>
  );
}

// ── Export buttons ────────────────────────────────────────────
interface ExportsProps {
  onCSV?: () => void;
  onExcel?: () => void;
  onTXT?: () => void;
  onPDF?: () => void;
}
export function Exports({ onCSV, onExcel, onTXT, onPDF }: ExportsProps) {
  // Using inline SVG icons to avoid importing lucide icons for minimal buttons
  const btns = [
    { l: "CSV", f: onCSV },
    { l: "Excel", f: onExcel },
    { l: "TXT", f: onTXT },
    { l: "PDF / Print", f: onPDF },
  ].filter((b) => b.f);

  return (
    <div
      className="noprint"
      style={{ display: "flex", gap: 7, flexWrap: "wrap" }}
    >
      {btns.map((b) => (
        <button
          key={b.l}
          onClick={b.f}
          className="exbtn"
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.textMuted,
            padding: "5px 13px",
            borderRadius: 6,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "'IBM Plex Mono',monospace",
          }}
        >
          ↓ {b.l}
        </button>
      ))}
    </div>
  );
}

// ── Recharts custom tooltip ───────────────────────────────────
export function ChartTip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.borderAccent}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 11,
        fontFamily: "'IBM Plex Mono',monospace",
        boxShadow: "0 8px 32px rgba(0,0,0,.5)",
      }}
    >
      <div style={{ color: C.text, fontWeight: 600, marginBottom: 6 }}>
        {String(label ?? "")}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{ color: String(p.color ?? C.textMuted), marginTop: 2 }}
        >
          {p.name}:{" "}
          <span style={{ color: C.text, fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Loading / Error states ────────────────────────────────────
export function LoadingState() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 300,
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: `3px solid ${C.border}`,
          borderTopColor: C.accent,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span
        style={{
          color: C.textMuted,
          fontSize: 11,
          fontFamily: "'IBM Plex Mono',monospace",
        }}
      >
        Fetching report data…
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 300,
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          color: C.critical,
          fontSize: 13,
          fontFamily: "'IBM Plex Mono',monospace",
        }}
      >
        ⚠ {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          background: "transparent",
          border: `1px solid ${C.border}`,
          color: C.textMuted,
          padding: "6px 16px",
          borderRadius: 6,
          fontSize: 11,
          cursor: "pointer",
          fontFamily: "'IBM Plex Mono',monospace",
        }}
      >
        Retry
      </button>
    </div>
  );
}
