// ============================================================
// reports/PriorityPathogens.tsx
// ============================================================
import { TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ReportQuery } from "../../types/reports";
import { usePriorityPathogens } from "../../hooks/misc/useReports";
import {
  exportCSV,
  exportExcel,
  exportTXT,
  type ExportRow,
} from "../../lib/exports";
import {
  C,
  Badge,
  Head,
  Exports,
  LoadingState,
  ErrorState,
  ChartTip,
} from "./ui";
import { useMultiNamespaceTranslation } from "@/i18n/hooks";

interface Props {
  query: Partial<ReportQuery>;
}

export function PriorityPathogens({ query }: Props) {
  const client = useKeycloakClient();
  const { t } = useMultiNamespaceTranslation(["common", "app"]);
  const { data, loading, error, refetch } = usePriorityPathogens(
    client.kc.token!,
    query,
  );
  if (loading) return <LoadingState />;
  if (error || !data)
    return <ErrorState message={error ?? t("app:reports.no_data")} onRetry={refetch} />;

  const flat: ExportRow[] = data.pathogens.map((p) => ({
    "WHO Priority": p.who_priority,
    Organism: p.full_name,
    "Total Isolates": p.total_isolates,
    "Key Resistance": p.key_resistance,
    "Jun Resistance %": p.trend.at(-1)?.pct ?? 0,
    "Jan Resistance %": p.trend[0]?.pct ?? 0,
  }));

  return (
    <div>
      {/* <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Head
          title="WHO Priority Pathogen Report"
          subtitle="Resistance rates for WHO Critical & High priority pathogens. Aligned with WHO Global Action Plan on AMR."
          meta={data.metadata.date_range}
        />
        <Exports
          onCSV={() => exportCSV(flat, "priority_pathogens")}
          onExcel={() =>
            exportExcel(
              [{ name: "Priority Pathogens", data: flat }],
              "priority_pathogens",
            )
          }
          onTXT={() => exportTXT(flat, "priority_pathogens")}
          onPDF={() => window.print()}
        />
      </div> */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))",
          gap: 16,
        }}
      >
        {data.pathogens.map((p) => {
          const crit = p.who_priority === "CRITICAL";
          const lc = crit ? C.critical : C.warning;
          const rising = (p.trend.at(-1)?.pct ?? 0) > (p.trend[0]?.pct ?? 0);
          return (
            <div
              key={p.organism_code}
              className="bg-card border-border border rounded-lg p-4 relative overflow-hidden shadow"
            >
              {/* <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: lc,
                  borderRadius: "10px 10px 0 0",
                }}
              /> */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "'Sora',sans-serif",
                      fontStyle: "italic",
                    }}
                  >
                    {p.full_name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "'IBM Plex Mono',monospace",
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {p.key_resistance}
                  </div>
                </div>
                <Badge v={crit ? "critical" : "medium"}>{p.who_priority}</Badge>
              </div>
              <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: "'IBM Plex Mono',monospace",
                      letterSpacing: ".09em",
                      marginBottom: 2,
                    }}
                  >
                    {t("app:reports.isolates")}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      fontFamily: "'Sora',sans-serif",
                    }}
                  >
                    {p.total_isolates}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: "'IBM Plex Mono',monospace",
                      letterSpacing: ".09em",
                      marginBottom: 2,
                    }}
                  >
                    {t("app:reports.six_month_trend")}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      fontFamily: "'Sora',sans-serif",
                      color: rising ? C.critical : C.success,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {p.trend[0]?.pct}% → {p.trend.at(-1)?.pct}%
                    {/* {rising ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )} */}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={75}>
                <AreaChart
                  data={p.trend}
                  margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id={`g${p.organism_code}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={lc} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={lc} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="pct"
                    stroke={lc}
                    strokeWidth={2}
                    fill={`url(#g${p.organism_code})`}
                    dot={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{
                      fontSize: 8,
                      fontFamily: "'IBM Plex Mono',monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTip />} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// reports/Surveillance.tsx
// ============================================================
import { AlertTriangle, Shield, AlertCircle } from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart as AC,
  Area as Ar,
  BarChart,
  Bar,
  XAxis as XX,
  YAxis,
  CartesianGrid,
  Tooltip as TT,
  Legend,
  ResponsiveContainer as RC,
  Cell,
  ReferenceLine,
} from "recharts";
import { useSurveillance } from "../../hooks/misc/useReports";
import { resColor as rc } from "./ui";
import { Stat as S } from "./ui";

export function Surveillance({ query }: Props) {
  const client = useKeycloakClient();
  const { t } = useMultiNamespaceTranslation(["common", "app"]);
  const { data, loading, error, refetch } = useSurveillance(
    client.kc.token!,
    query,
  );
  if (loading) return <LoadingState />;
  if (error || !data)
    return <ErrorState message={error ?? t("app:reports.no_data")} onRetry={refetch} />;

  const flatM: ExportRow[] = data.mrsa.trend.map((d) => ({
    Month: d.month,
    "Overall%": d.rate,
    "ICU%": d.icu,
    "General%": d.general,
    "Outpatient%": d.outpatient,
  }));
  const flatC: ExportRow[] = data.carbapenem.trend.map((d) => ({
    Month: d.month,
    "CRKP%": d.kpneu_cre,
    "CRPA%": d.paeru_cr,
    "CRAB%": d.abaum_cr,
  }));

  return (
    <div>
      {/* <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Head
          title="MRSA & Carbapenem Resistance Surveillance"
          subtitle="Tracking highest-priority resistance mechanisms. WHO GLASS mandatory indicators — CRE, MRSA, ESBL."
          meta={data.metadata.date_range}
        />
        <Exports
          onCSV={() => exportCSV(flatM, "mrsa_surveillance")}
          onExcel={() =>
            exportExcel(
              [
                { name: "MRSA", data: flatM },
                { name: "Carbapenem", data: flatC },
              ],
              "amr_surveillance",
            )
          }
          onTXT={() => exportTXT(flatM, "mrsa")}
          onPDF={() => window.print()}
        />
      </div> */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <S
          label={t("app:reports.mrsa_rate_label")}
          value={`${data.mrsa.trend.at(-1)?.rate ?? 0}%`}
          sub={t("app:reports.s_aureus_isolates")}
          color={C.critical}
          // Icon={AlertTriangle}
          trend={1.2}
        />
        <S
          label={t("app:reports.carbapenem_r_kpneu")}
          value={`${data.carbapenem.trend.at(-1)?.kpneu_cre ?? 0}%`}
          sub={t("app:reports.of_kpneumoniae")}
          color={C.high}
          // Icon={Shield}
          trend={0.8}
        />
        <S
          label={t("app:reports.carbapenem_r_abaum")}
          value={`${data.carbapenem.trend.at(-1)?.abaum_cr ?? 0}%`}
          sub={t("app:reports.of_abaumannii")}
          color={C.critical}
          // Icon={AlertTriangle}
          trend={2.1}
        />
        <S
          label={t("app:reports.esbl_ecoli")}
          value={`${data.esbl.trend.at(-1)?.ecoli ?? 0}%`}
          sub={t("app:reports.of_ecoli_isolates")}
          color={C.warning}
          // Icon={AlertCircle}
          trend={1.5}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div className="bg-card border-border border rounded-lg p-4 shadow">
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 3,
            }}
          >
            {t("app:reports.mrsa_rate_by_ward")}
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "'IBM Plex Mono',monospace",
              marginBottom: 16,
            }}
          >
            {t("app:reports.mrsa_ward_subtitle")}
          </div>
          <RC width="100%" height={195}>
            <LineChart data={data.mrsa.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XX
                dataKey="month"
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
                domain={[0, 80]}
              />
              <TT content={<ChartTip />} />
              <Legend
                wrapperStyle={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
              />
              <ReferenceLine
                y={50}
                stroke={C.critical}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <Line
                type="monotone"
                dataKey="rate"
                name={t("app:reports.overall")}
                stroke={C.critical}
                strokeWidth={2.5}
                dot={{ r: 3, fill: C.critical }}
              />
              <Line
                type="monotone"
                dataKey="icu"
                name={t("app:reports.icu")}
                stroke={C.high}
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 3"
              />
              <Line
                type="monotone"
                dataKey="general"
                name={t("app:reports.general_ward")}
                stroke={C.warning}
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 3"
              />
              <Line
                type="monotone"
                dataKey="outpatient"
                name={t("app:reports.outpatient")}
                stroke={C.success}
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 3"
              />
            </LineChart>
          </RC>
        </div>
        <div className="bg-card border-border border rounded-lg p-5 shadow">
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 3,
            }}
          >
            {t("app:reports.carbapenem_trends")}
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "'IBM Plex Mono',monospace",
              marginBottom: 16,
            }}
          >
            {t("app:reports.carbapenem_trends_subtitle")}
          </div>
          <RC width="100%" height={195}>
            <AC data={data.carbapenem.trend}>
              <defs>
                {(
                  [
                    ["gAb", C.critical],
                    ["gPa", C.high],
                    ["gKp", C.warning],
                  ] as [string, string][]
                ).map(([id, c]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={c} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XX
                dataKey="month"
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <TT content={<ChartTip />} />
              <Legend
                wrapperStyle={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
              />
              <Ar
                type="monotone"
                dataKey="abaum_cr"
                name="CRAB"
                stroke={C.critical}
                strokeWidth={2}
                fill="url(#gAb)"
              />
              <Ar
                type="monotone"
                dataKey="paeru_cr"
                name="CRPA"
                stroke={C.high}
                strokeWidth={2}
                fill="url(#gPa)"
              />
              <Ar
                type="monotone"
                dataKey="kpneu_cre"
                name="CRKP"
                stroke={C.warning}
                strokeWidth={2}
                fill="url(#gKp)"
              />
            </AC>
          </RC>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="bg-card border-border border rounded-lg p-4 shadow">
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {t("app:reports.carbapenem_by_mechanism")}
          </div>
          <RC width="100%" height={175}>
            <BarChart data={data.carbapenem.by_mechanism} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.grid}
                horizontal={false}
              />
              <XX
                type="number"
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
              />
              <YAxis
                type="category"
                dataKey="mechanism"
                tick={{
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
                width={75}
              />
              <TT content={<ChartTip />} />
              <Bar dataKey="pct" name={t("app:reports.resistance_pct")} radius={[0, 4, 4, 0]}>
                {data.carbapenem.by_mechanism.map((e, i) => (
                  <Cell key={i} fill={rc(e.pct)} />
                ))}
              </Bar>
            </BarChart>
          </RC>
        </div>
        <div className="bg-card border-border border rounded-lg p-4 shadow">
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 3,
            }}
          >
            {t("app:reports.esbl_prevalence_trend")}
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "'IBM Plex Mono',monospace",
              marginBottom: 16,
            }}
          >
            {t("app:reports.esbl_subtitle")}
          </div>
          <RC width="100%" height={175}>
            <LineChart data={data.esbl.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XX
                dataKey="month"
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
                domain={[40, 90]}
              />
              <TT content={<ChartTip />} />
              <Legend
                wrapperStyle={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
              />
              <Line
                type="monotone"
                dataKey="ecoli"
                name={t("app:reports.ecoli_esbl_pct")}
                stroke={C.accentBlue}
                strokeWidth={2}
                dot={{ r: 3, fill: C.accentBlue }}
              />
              <Line
                type="monotone"
                dataKey="kpneu"
                name={t("app:reports.kpneu_esbl_pct")}
                stroke={C.warning}
                strokeWidth={2}
                dot={{ r: 3, fill: C.warning }}
              />
            </LineChart>
          </RC>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// reports/Workload.tsx
// ============================================================
import { Activity, BarChart2, Clock, CheckCircle, XCircle } from "lucide-react";
import {
  BarChart as BC,
  Bar as B,
  XAxis as X2,
  YAxis as Y2,
  CartesianGrid as CG,
  Tooltip as T2,
  Legend as L2,
  ResponsiveContainer as R2,
  PieChart,
  Pie,
  Cell as CE,
} from "recharts";
import { useWorkload } from "../../hooks/misc/useReports";

export function Workload({ query }: Props) {
  const client = useKeycloakClient();
  const { t } = useMultiNamespaceTranslation(["common", "app"]);
  const { data, loading, error, refetch } = useWorkload(
    client.kc.token!,
    query,
  );
  if (loading) return <LoadingState />;
  if (error || !data)
    return <ErrorState message={error ?? t("app:reports.no_data")} onRetry={refetch} />;

  const flatV: ExportRow[] = data.monthly_volumes.map((d) => ({
    Month: d.month,
    Chemistry: d.CH,
    Microbiology: d.MB,
    Haematology: d.HM,
    Serology: d.SE,
    Total: d.total,
  }));
  const flatT: ExportRow[] = data.tat_by_section.map((d) => ({
    Section: d.section,
    "P50 (hrs)": d.p50,
    "P90 (hrs)": d.p90,
    "Target (hrs)": d.target,
  }));

  return (
    <div>
      {/* <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Head
          title="Laboratory Workload & Turnaround Time"
          subtitle="Test volumes by section and TAT performance vs. WHO-recommended targets."
          meta={data.metadata.date_range}
        />
        <Exports
          onCSV={() => exportCSV(flatV, "workload")}
          onExcel={() =>
            exportExcel(
              [
                { name: "Volumes", data: flatV },
                { name: "TAT", data: flatT },
              ],
              "workload_tat",
            )
          }
          onTXT={() => exportTXT(flatV, "workload")}
          onPDF={() => window.print()}
        />
      </div> */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <S
          label={t("app:reports.total_requests")}
          value={data.monthly_volumes
            .reduce((s, d) => s + d.total, 0)
            .toLocaleString()}
          sub={t("app:reports.period_total")}
          // Icon={Activity}
        />
        <S
          label={t("app:reports.monthly_average")}
          value={Math.round(
            data.monthly_volumes.reduce((s, d) => s + d.total, 0) /
              data.monthly_volumes.length,
          ).toLocaleString()}
          sub={t("app:reports.requests_per_month")}
          // Icon={BarChart2}
        />
        <S
          label={t("app:reports.microbiology")}
          value={data.monthly_volumes
            .reduce((s, d) => s + d.MB, 0)
            .toLocaleString()}
          sub={t("app:reports.culture_sensitivity")}
          color={C.accentBlue}
          // Icon={Activity}
        />
        <S
          label={t("app:reports.tat_targets_met")}
          value={`${
            data.tat_by_section.filter((t) => t.p90 <= t.target).length
          }/${data.tat_by_section.length}`}
          sub={t("app:reports.sections_within_target")}
          color={C.warning}
          // Icon={Clock}
          // trend={-1}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div className="bgcard border-border border rounded-lg p-4 shadow">
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {t("app:reports.monthly_test_volume")}
          </div>
          <R2 width="100%" height={215}>
            <BC data={data.monthly_volumes}>
              <CG strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <X2
                dataKey="month"
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <Y2
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <T2 content={<ChartTip />} />
              <L2
                wrapperStyle={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
              />
              <B
                dataKey="CH"
                name={t("app:reports.chemistry")}
                stackId="a"
                fill={C.accentBlue}
              />
              <B dataKey="HM" name={t("app:reports.haematology")} stackId="a" fill={C.accent} />
              <B dataKey="MB" name={t("app:reports.microbiology")} stackId="a" fill={C.purple} />
              <B
                dataKey="SE"
                name={t("app:reports.serology")}
                stackId="a"
                fill={C.warning}
                radius={[4, 4, 0, 0]}
              />
            </BC>
          </R2>
        </div>
        <div className="bgcard border-border border rounded-lg p-4 shadow">
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            {t("app:dashboard.specimen_distribution")}
          </div>
          <R2 width="100%" height={155}>
            <PieChart>
              <Pie
                data={data.specimen_type_dist}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={68}
                dataKey="value"
                nameKey="name"
              >
                {data.specimen_type_dist.map((e, i) => (
                  <CE key={i} fill={e.color} />
                ))}
              </Pie>
              <T2 content={<ChartTip />} />
            </PieChart>
          </R2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 3,
              marginTop: 6,
            }}
          >
            {data.specimen_type_dist.map((s) => (
              <div
                key={s.name}
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "'IBM Plex Mono',monospace",
                  }}
                >
                  {s.name} ({s.value}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bgcard border-border border rounded-lg p-4 shadow">
        <div
          style={{
            fontFamily: "'Sora',sans-serif",
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {t("app:reports.tat_performance")}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr className="border-border border-b">
              {[
                t("app:reports.section_col"),
                t("app:reports.median_p50"),
                t("app:reports.pct_p90"),
                t("app:reports.target_col"),
                t("app:reports.status_col"),
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 14px",
                    fontSize: 10,
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontWeight: 500,
                    letterSpacing: ".07em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.tat_by_section.map((row, i) => {
              const ok = row.p90 <= row.target;
              return (
                <tr key={i} className="hr border-b border-border">
                  <td
                    style={{
                      padding: "12px 14px",
                      fontSize: 13,
                      fontFamily: "'Sora',sans-serif",
                    }}
                  >
                    {row.section}{" "}
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "'IBM Plex Mono',monospace",
                      }}
                    >
                      ({row.code})
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",

                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono',monospace",
                    }}
                  >
                    {row.p50}h
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono',monospace",
                      color: row.p90 > row.target ? C.critical : C.text,
                      fontWeight: row.p90 > row.target ? 700 : 400,
                    }}
                  >
                    {row.p90}h
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",

                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono',monospace",
                    }}
                  >
                    {row.target}h
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {ok ? (
                        <CheckCircle size={13} color={C.success} />
                      ) : (
                        <XCircle size={13} color={C.critical} />
                      )}
                      <span
                        style={{
                          color: ok ? C.success : C.critical,
                          fontSize: 10,
                          fontFamily: "'IBM Plex Mono',monospace",
                        }}
                      >
                        {ok ? t("app:reports.within_target") : t("app:reports.exceeds_target")}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// reports/Geographic.tsx
// ============================================================
import { useState } from "react";
import type { FacilityGeo } from "../../types/reports";
import { useGeographic } from "../../hooks/misc/useReports";

type MetricKey = "mrsa_rate" | "cre_rate" | "esbl_rate";

export function Geographic({ query }: Props) {
  const client = useKeycloakClient();
  const { t } = useMultiNamespaceTranslation(["common", "app"]);
  const { data, loading, error, refetch } = useGeographic(
    client.kc.token!,
    query,
  );
  const [metric, setMetric] = useState<MetricKey>("mrsa_rate");
  if (loading) return <LoadingState />;
  if (error || !data)
    return <ErrorState message={error ?? t("app:reports.no_data")} onRetry={refetch} />;

  const labels: Record<MetricKey, string> = {
    mrsa_rate: t("app:reports.mrsa_rate_pct"),
    cre_rate: t("app:reports.cre_rate_pct"),
    esbl_rate: t("app:reports.esbl_rate_pct"),
  };
  const colors: Record<MetricKey, string> = {
    mrsa_rate: C.critical,
    cre_rate: C.high,
    esbl_rate: C.warning,
  };
  const sorted = [...data.facilities].sort((a, b) => b[metric] - a[metric]);
  const flat: ExportRow[] = data.facilities.map((f) => ({
    Facility: f.facility_name,
    Region: f.region,
    District: f.district,
    "Total Isolates": f.total_isolates,
    "MRSA%": f.mrsa_rate,
    "CRE%": f.cre_rate,
    "ESBL%": f.esbl_rate,
    Lat: f.lat,
    Lng: f.lng,
  }));
  const maxVal = Math.max(...data.facilities.map((f) => f[metric]));
  const national = (
    data.facilities.reduce((s, f) => s + f[metric], 0) / data.facilities.length
  ).toFixed(1);

  return (
    <div>
      {/* <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Head
          title="Geographic Resistance Distribution"
          subtitle="AMR resistance rates by reporting facility and administrative region."
          meta={`Tanzania · ${data.metadata.date_range}`}
        />
        <Exports
          onCSV={() => exportCSV(flat, "geographic_resistance")}
          onExcel={() =>
            exportExcel(
              [{ name: "Geographic", data: flat }],
              "geographic_resistance",
            )
          }
          onTXT={() => exportTXT(flat, "geographic_resistance")}
          onPDF={() => window.print()}
        />
      </div> */}
      <div
        className="noprint"
        style={{ display: "flex", gap: 8, marginBottom: 20 }}
      >
        {(Object.entries(labels) as [MetricKey, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={cn(
                "border rounded-md",
                metric === key
                  ? `bg-secondary border-border`
                  : "border-border text-foreground",
              )}
              style={{
                padding: "6px 16px",
                // borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "'IBM Plex Mono',monospace",
                transition: "all .15s",
                // border: `1px solid ${metric === key ? colors[key] : C.border}`,
                // background: metric === key ? `${colors[key]}14` : "transparent",
                // color: metric === key ? colors[key] : C.textMuted,
              }}
            >
              {label}
            </button>
          ),
        )}
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 18 }}
      >
        <div className="bg-card border-border border rounded-lg p-4 shadow">
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {t("app:reports.facility_map")} — {labels[metric]}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <svg
              viewBox="0 0 300 380"
              style={{
                width: "100%",
                maxWidth: 300,
                height: "auto",
              }}
            >
              <path
                d="M85 18 L195 14 L238 38 L258 78 L252 128 L268 158 L258 198 L275 238 L265 278 L225 310 L185 342 L148 360 L108 350 L76 328 L48 288 L30 238 L42 188 L26 148 L42 98 L62 58 Z"
                fill="#0A1830"
                stroke="#1C3050"
                strokeWidth="2"
              />
              <ellipse
                cx="258"
                cy="128"
                rx="16"
                ry="20"
                fill="#0A1830"
                stroke="#1C3050"
                strokeWidth="1.5"
              />
              <text
                x="262"
                y="131"
                fill="#1C3050"
                fontSize="7"
                fontFamily="'IBM Plex Mono',monospace"
              >
                ZNZ
              </text>
              {[80, 120, 160, 200, 240, 280, 320].map((y) => (
                <line
                  key={y}
                  x1="22"
                  y1={y}
                  x2="278"
                  y2={y}
                  stroke="#081422"
                  strokeWidth=".5"
                />
              ))}
              {[60, 100, 140, 180, 220, 260].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1="8"
                  x2={x}
                  y2="372"
                  stroke="#081422"
                  strokeWidth=".5"
                />
              ))}
              {data.facilities.map((f: FacilityGeo) => {
                const x = 28 + ((f.lng - 29.5) / 11) * 244;
                const y = 18 + ((-f.lat - 1) / 10.5) * 344;
                const r = 8 + Math.sqrt(f.total_isolates / 512) * 16;
                const val = f[metric];
                const col = rc(val);
                return (
                  <g key={f.facility_code}>
                    {val === maxVal && (
                      <circle
                        cx={x}
                        cy={y}
                        r={r + 10}
                        fill="transparent"
                        stroke={col}
                        strokeWidth="1"
                        strokeDasharray="3 3"
                        opacity={0.5}
                      >
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from={`0 ${x} ${y}`}
                          to={`360 ${x} ${y}`}
                          dur="10s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                    <circle cx={x} cy={y} r={r} fill={col} opacity={0.55} />
                    <circle
                      cx={x}
                      cy={y}
                      r={Math.min(r * 0.45, 5)}
                      fill={col}
                    />
                    <text
                      x={x + r + 5}
                      y={y + 4}
                      fill={C.text}
                      fontSize="9"
                      fontFamily="'IBM Plex Mono',monospace"
                      fontWeight="600"
                    >
                      {f.facility_code}
                    </text>
                    <text
                      x={x + r + 5}
                      y={y + 14}
                      fill={col}
                      fontSize="9"
                      fontFamily="'IBM Plex Mono',monospace"
                      fontWeight="700"
                    >
                      {val}%
                    </text>
                  </g>
                );
              })}
              <text
                x="148"
                y="11"
                fill="#1E3A58"
                fontSize="7.5"
                textAnchor="middle"
                fontFamily="'IBM Plex Mono',monospace"
              >
                N
              </text>
              <text
                x="148"
                y="374"
                fill="#1E3A58"
                fontSize="7.5"
                textAnchor="middle"
                fontFamily="'IBM Plex Mono',monospace"
              >
                S
              </text>
            </svg>
          </div>
          <div
            style={{
              textAlign: "center",
              fontSize: 9,
              fontFamily: "'IBM Plex Mono',monospace",
              marginTop: 6,
            }}
          >
            {t("app:reports.bubble_size_note")}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="bg-card border-border border rounded-lg p-4 shadow">
            <div
              style={{
                fontFamily: "'Sora',sans-serif",
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 18,
              }}
            >
              {t("app:reports.facilities_ranked")} — {labels[metric]}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {sorted.map((f, i) => {
                const val = f[metric];
                const col = rc(val);
                return (
                  <div key={f.facility_code}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "'IBM Plex Mono',monospace",
                              minWidth: 18,
                            }}
                          >
                            #{i + 1}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontFamily: "'Sora',sans-serif",
                            }}
                          >
                            {f.facility_name}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: "'IBM Plex Mono',monospace",
                            marginLeft: 26,
                          }}
                        >
                          {f.region} · n={f.total_isolates.toLocaleString()}
                        </div>
                      </div>
                      <span
                        style={{
                          color: col,
                          fontWeight: 700,
                          fontSize: 18,
                          fontFamily: "'IBM Plex Mono',monospace",
                        }}
                      >
                        {val}%
                      </span>
                    </div>
                    <div
                      className="border h-1.25 border-[]"
                      style={{
                        borderRadius: 4,
                        height: 5,
                      }}
                    >
                      <div
                        style={{
                          background: col,
                          width: `${(val / maxVal) * 100}%`,
                          height: "100%",
                          borderRadius: 4,
                          boxShadow: `0 0 6px ${col}50`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-card border-border border rounded-lg p-4 shadow">
            <div
              style={{
                fontSize: 9,
                fontFamily: "'IBM Plex Mono',monospace",
                letterSpacing: ".09em",
                marginBottom: 4,
              }}
            >
              {t("app:reports.national_average")} · {labels[metric]}
            </div>
            <div
              style={{
                color: colors[metric],
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "'Sora',sans-serif",
              }}
            >
              {national}%
            </div>
            <div
              style={{
                fontSize: 10,
                fontFamily: "'IBM Plex Mono',monospace",
                marginTop: 2,
              }}
            >
              {t("app:reports.across_facilities", { count: data.facilities.length })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// reports/DataQuality.tsx
// ============================================================
import { Database, Layers, Building2, RefreshCw } from "lucide-react";
import {
  BarChart as BQ,
  Bar as BQB,
  XAxis as BQX,
  YAxis as BQY,
  CartesianGrid as BQG,
  Tooltip as BQT,
  ResponsiveContainer as BQR,
  LineChart as BQL,
  Line as BQLi,
} from "recharts";
import type { FacilityQuality } from "../../types/reports";
import { useDataQuality } from "../../hooks/misc/useReports";
import { cn } from "@/lib/utils";
import { useKeycloakClient } from "../react-keycloak-provider";

export function DataQuality({ query }: Props) {
  const client = useKeycloakClient();
  const { t } = useMultiNamespaceTranslation(["common", "app"]);
  const { data, loading, error, refetch } = useDataQuality(
    client.kc.token!,
    query,
  );
  if (loading) return <LoadingState />;
  if (error || !data)
    return <ErrorState message={error ?? t("app:reports.no_data")} onRetry={refetch} />;

  const flat: ExportRow[] = data.facilities.map((f) => ({
    Facility: f.facility,
    Batches: f.batches,
    Records: f.records,
    "Success Rate%": f.success_rate,
    "Demographics%": f.completeness_demo,
    "Organism ID%": f.completeness_organism,
    "AST Results%": f.completeness_ast,
    "Specimen%": f.completeness_specimen,
  }));
  const avgComp = (key: keyof FacilityQuality) =>
    Math.round(
      data.facilities.reduce((s, f) => s + (f[key] as number), 0) /
        data.facilities.length,
    );
  const QCell = ({ v }: { v: number }) => {
    const col = v >= 90 ? C.success : v >= 80 ? C.warning : C.critical;
    return (
      <span
        style={{
          color: col,
          fontSize: 12,
          fontFamily: "'IBM Plex Mono',monospace",
          fontWeight: 700,
        }}
      >
        {v}%
      </span>
    );
  };
  const completeness: { label: string; key: keyof FacilityQuality }[] = [
    { label: t("app:reports.patient_demographics"), key: "completeness_demo" },
    { label: t("app:reports.organism_identification"), key: "completeness_organism" },
    { label: t("app:reports.ast_results"), key: "completeness_ast" },
    { label: t("app:reports.specimen_info"), key: "completeness_specimen" },
  ];

  return (
    <div>
      {/* <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Head
          title="Data Quality & Completeness Audit"
          subtitle="Import success rates, field completeness scoring, and facility reporting status. Maps to WHO GLASS data quality scorecard."
          meta={data.metadata.date_range}
        />
        <Exports
          onCSV={() => exportCSV(flat, "data_quality")}
          onExcel={() =>
            exportExcel([{ name: "Quality Audit", data: flat }], "data_quality")
          }
          onTXT={() => exportTXT(flat, "data_quality")}
          onPDF={() => window.print()}
        />
      </div> */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <S
          label={t("app:reports.total_batches")}
          value={data.summary.total_batches.toLocaleString()}
          sub={t("app:reports.import_batches")}
          // Icon={Database}
        />
        <S
          label={t("app:reports.total_records")}
          value={data.summary.total_records.toLocaleString()}
          sub={t("app:reports.laboratory_records")}
          // Icon={Layers}
        />
        <S
          label={t("app:reports.success_rate_label")}
          value={`${data.summary.success_rate}%`}
          sub={t("app:reports.records_processed_ok")}
          // color={C.success}
          // Icon={CheckCircle}
        />
        <S
          label={t("app:reports.active_facilities")}
          value={String(data.summary.facilities_active)}
          sub={t("app:reports.reporting_facilities")}
          // Icon={Building2}
        />
        <S
          label={t("app:reports.last_import")}
          value={data.summary.last_import}
          sub={t("app:reports.most_recent_batch")}
          // color={C.accent}
          // Icon={RefreshCw}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div className="bg-card border-border border rounded-lg p-4 shadow">
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {t("app:reports.monthly_ingestion")}
          </div>
          <BQR width="100%" height={195}>
            <BQL data={data.monthly_ingestion}>
              <BQG strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <BQX
                dataKey="month"
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <BQY
                yAxisId="l"
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <BQY
                yAxisId="r"
                orientation="right"
                domain={[88, 98]}
                tick={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <BQT content={<ChartTip />} />
              <BQB
                yAxisId="l"
                dataKey="records"
                name={t("app:reports.records_label")}
                fill={C.accentBlue}
                fillOpacity={0.45}
                radius={[4, 4, 0, 0]}
              />
              <BQLi
                yAxisId="r"
                type="monotone"
                dataKey="success_rate"
                name={t("app:reports.success_pct")}
                stroke={C.accent}
                strokeWidth={2.5}
                dot={{ r: 3, fill: C.accent }}
              />
            </BQL>
          </BQR>
        </div>
        <div className="bg-card border-border border rounded-lg p-4 shadow">
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 18,
            }}
          >
            {t("app:reports.avg_field_completeness")}
          </div>
          {completeness.map((item) => {
            const v = avgComp(item.key);
            const col = v >= 90 ? C.success : v >= 80 ? C.warning : C.critical;
            return (
              <div key={item.key as string} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "'IBM Plex Mono',monospace",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      color: col,
                      fontSize: 11,
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontWeight: 700,
                    }}
                  >
                    {v}%
                  </span>
                </div>
                <div
                  style={{ background: C.border, borderRadius: 4, height: 5 }}
                >
                  <div
                    style={{
                      background: col,
                      width: `${v}%`,
                      height: "100%",
                      borderRadius: 4,
                      boxShadow: `0 0 5px ${col}45`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-card border-border border rounded-lg p-4 shadow">
        <div
          style={{
            fontFamily: "'Sora',sans-serif",
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {t("app:reports.completeness_matrix")}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[
                  t("app:dashboard.facility"),
                  t("app:reports.batches_col"),
                  t("app:reports.records_col"),
                  t("app:reports.success_rate_label"),
                  t("app:reports.demographics_col"),
                  t("app:reports.organism_id_col"),
                  t("app:reports.ast_results"),
                  t("app:reports.specimen_col"),
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 12px",

                      fontSize: 9,
                      fontFamily: "'IBM Plex Mono',monospace",
                      textAlign: "left",
                      fontWeight: 500,
                      letterSpacing: ".07em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.facilities.map((f, i) => (
                <tr
                  key={i}
                  className="hr"
                  style={{ borderBottom: `1px solid ${C.grid}` }}
                >
                  <td
                    style={{
                      padding: "10px 12px",

                      fontSize: 12,
                      fontFamily: "'Sora',sans-serif",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.facility}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",

                      fontSize: 11,
                      fontFamily: "'IBM Plex Mono',monospace",
                    }}
                  >
                    {f.batches}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",

                      fontSize: 11,
                      fontFamily: "'IBM Plex Mono',monospace",
                    }}
                  >
                    {f.records.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <QCell v={f.success_rate} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <QCell v={f.completeness_demo} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <QCell v={f.completeness_organism} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <QCell v={f.completeness_ast} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <QCell v={f.completeness_specimen} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}
        >
          {(
            [
              [C.success, "≥90%", t("app:reports.good")],
              [C.warning, "80–89%", t("app:reports.needs_attention")],
              [C.critical, "<80%", t("app:reports.action_required")],
            ] as [string, string, string][]
          ).map(([c, r, l]) => (
            <div
              key={r}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <div
                style={{ width: 9, height: 9, borderRadius: 2, background: c }}
              />
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
              >
                {r} — {l}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
