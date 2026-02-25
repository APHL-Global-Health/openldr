import { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DatabaseStats as DatabaseStatsType } from "@/types/database";

interface DatabaseStatsCardProps {
  databases: DatabaseStatsType[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function ConnectionGauge({ active, max }: { active: number; max: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const size = 56;
    const radius = size / 2 - 4;
    const strokeWidth = 5;
    const pct = max > 0 ? active / max : 0;

    const g = svg
      .attr("width", size)
      .attr("height", size)
      .append("g")
      .attr("transform", `translate(${size / 2},${size / 2})`);

    // Background arc
    const arcBg = d3
      .arc()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(-Math.PI * 0.75)
      .endAngle(Math.PI * 0.75)
      .cornerRadius(2);

    g.append("path")
      .attr("d", arcBg as any)
      .attr("fill", "currentColor")
      .attr("opacity", 0.08);

    // Value arc
    const endAngle = -Math.PI * 0.75 + pct * Math.PI * 1.5;
    const arcVal = d3
      .arc()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(-Math.PI * 0.75)
      .endAngle(endAngle)
      .cornerRadius(2);

    const color = pct > 0.85 ? "#ef4444" : pct > 0.6 ? "#f59e0b" : "#22c55e";

    g.append("path")
      .attr("d", arcVal as any)
      .attr("fill", color);

    // Center text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "currentColor")
      .text(active);
  }, [active, max]);

  return <svg ref={ref} />;
}

export function DatabaseStatsCard({ databases }: DatabaseStatsCardProps) {
  return (
    <div className="cursor-default border-border border bg-card rounded-sm shadow h-full">
      <div className="flex items-center min-h-10 max-h-10 text-xs py-2 px-4 border-border border-b">
        DATABASES
      </div>

      <div className="w-full min-h-[calc(100%-40px)] max-h-[calc(100%-40px)] grid grid-cols-1 lg:grid-cols-2">
        {databases.map((db, index) => {
          const connPct =
            db.maxConnections > 0
              ? (db.activeConnections / db.maxConnections) * 100
              : 0;

          const showingSize = db.tables
            .filter((table) => table.rowCount > 0)
            .slice(0, 10)
            .reduce((sum, table) => sum + table.sizeBytes, 0);

          return (
            <div
              className={cn(
                index === 0
                  ? "border-border border-r border-b sm:border-r-0 sm:border-b md:border-r-0 md:border-b lg:border-r"
                  : "",
              )}
            >
              <div className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex w-full text-sm font-medium min-h-10 max-h-10 py-2 px-4 border-border border-b items-center justify-between">
                    {db.name}
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(showingSize)}
                      {" / "}
                      {formatBytes(db.sizeBytes)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {/* Quick stats row */}
                <div className="grid grid-cols-3 gap-3 p-2">
                  <div className="flex items-center gap-2">
                    <ConnectionGauge
                      active={db.activeConnections}
                      max={db.maxConnections}
                    />
                    <div>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Connections
                      </p>
                      <p className="text-xs font-medium">
                        {db.activeConnections}/{db.maxConnections}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-lg border p-2">
                    <p className="text-lg font-semibold leading-none">
                      {db.tableCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Tables</p>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-lg border p-2">
                    <p className="ttext-lg font-semibold leading-none">
                      {db.uptime}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Uptime</p>
                  </div>
                </div>

                {/* Connection bar */}
                <div className="border-border border-b pb-4 px-2">
                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>Connection Pool</span>
                    <span>{connPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        connPct > 85
                          ? "bg-red-500"
                          : connPct > 60
                            ? "bg-amber-500"
                            : "bg-emerald-500",
                      )}
                      style={{ width: `${Math.min(connPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Table details */}
                {db.tables.length > 0 && (
                  <div className="max-h-48 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">#</TableHead>
                          <TableHead className="text-[10px]">Table</TableHead>
                          <TableHead className="text-[10px] text-right">
                            Rows
                          </TableHead>
                          <TableHead className="text-[10px] text-right">
                            Size
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {db.tables
                          // .sort((a, b) => b.rowCount - a.rowCount)
                          .filter((table) => table.rowCount > 0)
                          .slice(0, 10)
                          .map((table, index) => (
                            <TableRow key={table.tableName}>
                              <TableCell className="text-xs py-1.5 w-16">
                                {String(index + 1).padStart(2, "0")}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 ">
                                {table.tableName}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-right">
                                {table.rowCount.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-right">
                                {formatBytes(table.sizeBytes)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
