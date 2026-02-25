import { cn } from "@/lib/utils";
import type { DashboardKPI } from "@/types/database";

interface StatCardProps {
  label: string;
  value: number;
}

function formatCount(n: number): string {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

interface KPIGridProps {
  kpi: DashboardKPI;
}

export function KPIGrid({ kpi }: KPIGridProps) {
  const cards: StatCardProps[] = [
    {
      label: "Patients",
      value: kpi.totalPatients,
    },
    {
      label: "Requests",
      value: kpi.totalLabRequests,
    },
    {
      label: "Results",
      value: kpi.totalLabResults,
    },
  ];

  return (
    <div>
      <div className="cursor-default border-border border bg-card rounded-sm shadow">
        <div className="flex items-center min-h-10 max-h-10 text-xs py-2 px-4 border-border border-b">
          LAB DATA
        </div>
        <div className="p-2 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-3">
          {cards.map((card, index) => (
            <div
              className={cn(
                "p-4 flex flex-col justify-center items-center",
                index == 1
                  ? "border-border  border-t border-b sm:border-l sm:border-r sm:border-t-0 sm:border-b-0 md:border-l md:border-r md:border-t-0 md:border-b-0 xl:border-l xl:border-r xl:border-t-0 xl:border-b-0"
                  : "",
              )}
            >
              <p className="text-2xl font-semibold tracking-tight">
                {formatCount(card.value)}
              </p>
              <div className="text-md text-muted-foreground flex items-center justify-center gap-2">
                <span className="flex items-center justify-center">
                  {card.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
