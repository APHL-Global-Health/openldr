import { AlertTriangle, Layers, Zap, Microscope } from "lucide-react";
import type { ReportQuery, AntibiogramRow } from "../../types/reports";
import { useAntibiogram } from "../../hooks/misc/useReports";
import { useMultiNamespaceTranslation } from "@/i18n/hooks";
import {
  exportCSV,
  exportExcel,
  exportTXT,
  type ExportRow,
} from "../../lib/exports";
import {
  C,
  resColor,
  Stat,
  Head,
  Exports,
  LoadingState,
  ErrorState,
} from "./ui";
import { useKeycloakClient } from "../react-keycloak-provider";

interface Props {
  query: Partial<ReportQuery>;
}

export default function Antibiogram({ query }: Props) {
  const { t } = useMultiNamespaceTranslation(["common", "app"]);
  const client = useKeycloakClient();
  const { data, loading, error, refetch } = useAntibiogram(
    client.kc.token!,
    query,
  );

  if (loading) return <LoadingState />;
  if (error || !data)
    return <ErrorState message={error ?? t("app:reports.no_data")} onRetry={refetch} />;

  const organisms = [...new Set(data.data.map((d) => d.organism_code))];
  const antibiotics = [...new Set(data.data.map((d) => d.antibiotic_code))];
  const orgNames: Record<string, string> = {};
  const abxNames: Record<string, string> = {};
  const map: Record<string, AntibiogramRow> = {};
  data.data.forEach((d) => {
    orgNames[d.organism_code] = d.organism_name;
    abxNames[d.antibiotic_code] = d.antibiotic_name;
    map[`${d.organism_code}_${d.antibiotic_code}`] = d;
  });

  const flat: ExportRow[] = data.data.map((d) => ({
    Organism: d.organism_name,
    Antibiotic: d.antibiotic_name,
    Tested: d.total_tested,
    Resistant: d.resistant,
    Intermediate: d.intermediate,
    Susceptible: d.susceptible,
    "Resistance%": d.resistance_pct,
  }));

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* <Head
          title="National Antibiogram"
          subtitle="Cumulative antibiogram — resistance % by organism × antibiotic. Minimum 30 isolates per cell. WHO GLASS-compatible."
          meta={`${data.metadata.facility} · ${data.metadata.date_range} · ${data.metadata.guideline}`}
        />
        <Exports
          onCSV={() => exportCSV(flat, "antibiogram")}
          onExcel={() =>
            exportExcel([{ name: "Antibiogram", data: flat }], "antibiogram")
          }
          onTXT={() => exportTXT(flat, "antibiogram")}
          onPDF={() => window.print()}
        /> */}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 26,
        }}
      >
        <Stat
          label={t("app:reports.total_isolates")}
          value={data.data
            .reduce((s, d) => s + d.total_tested, 0)
            .toLocaleString()}
          sub={t("app:reports.across_all_organisms")}
          // Icon={Microscope}
        />
        <Stat
          label={t("app:reports.organisms")}
          value={String(organisms.length)}
          sub={t("app:reports.pathogen_species")}
          // Icon={Layers}
        />
        <Stat
          label={t("app:reports.antibiotics")}
          value={String(antibiotics.length)}
          sub={t("app:reports.drug_classes")}
          // Icon={Zap}
        />
        <Stat
          label={t("app:reports.avg_resistance")}
          value={`${Math.round(
            data.data.reduce((s, d) => s + d.resistance_pct, 0) /
              data.data.length,
          )}%`}
          sub={t("app:reports.all_pairs")}
          color={C.warning}
          // Icon={AlertTriangle}
          trend={3.2}
        />
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 14,
          marginBottom: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: "'IBM Plex Mono',monospace",
            letterSpacing: ".08em",
          }}
        >
          {t("app:reports.resistance_pct")}
        </span>
        {(
          [
            ["0–5", resColor(2)],
            ["5–20", resColor(12)],
            ["20–40", resColor(30)],
            ["40–60", resColor(50)],
            ["60–80", resColor(70)],
            ["≥80", resColor(90)],
            ["—", C.card],
          ] as [string, string][]
        ).map(([l, c]) => (
          <div
            key={l}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <div
              style={{
                width: 13,
                height: 13,
                borderRadius: 3,
                background: c,
                border: `1px solid ${C.border}`,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontFamily: "'IBM Plex Mono',monospace",
              }}
            >
              {l}
            </span>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 3 }}>
          <thead>
            <tr>
              <th
                style={{
                  width: 200,
                  textAlign: "left",
                  padding: "4px 8px",

                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontWeight: 500,
                }}
              />
              {antibiotics.map((abx: any) => (
                <th
                  key={abx}
                  style={{
                    padding: "2px",

                    fontSize: 9,
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontWeight: 500,
                    writingMode: "vertical-lr",
                    transform: "rotate(180deg)",
                    height: 88,
                    verticalAlign: "bottom",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                  }}
                >
                  {abxNames[abx] ?? abx}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {organisms.map((org: any) => (
              <tr key={org}>
                <td
                  style={{
                    padding: "3px 8px",

                    fontSize: 12,
                    fontFamily: "'IBM Plex Mono',monospace",
                    whiteSpace: "nowrap",
                    fontStyle: "italic",
                    verticalAlign: "middle",
                  }}
                >
                  {orgNames[org]}
                </td>
                {antibiotics.map((abx: any) => {
                  const cell = map[`${org}_${abx}`];
                  const pct = cell?.resistance_pct ?? null;
                  return (
                    <td
                      key={abx}
                      title={
                        cell
                          ? `${orgNames[org]} · ${abxNames[abx]}\n${pct}% resistant (n=${cell.total_tested})`
                          : t("app:reports.not_tested")
                      }
                    >
                      <div
                        className="hcell"
                        style={{
                          width: 50,
                          height: 38,
                          borderRadius: 5,
                          margin: "0 auto",
                          background: resColor(pct),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: pct !== null ? 11 : 10,
                          fontWeight: 700,
                          fontFamily: "'IBM Plex Mono',monospace",
                          boxShadow:
                            pct != null && pct >= 80
                              ? `0 0 10px rgba(255,69,96,.45)`
                              : pct != null && pct >= 60
                              ? `0 0 7px rgba(255,107,69,.3)`
                              : "none",
                        }}
                      >
                        {pct !== null ? `${pct}%` : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p
        style={{
          fontSize: 10,
          marginTop: 10,
          fontFamily: "'IBM Plex Mono',monospace",
        }}
      >
        {t("app:reports.footnote")} Breakpoints: {data.metadata.guideline}.
      </p>
    </div>
  );
}
