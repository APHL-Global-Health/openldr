import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FacilityActivity } from "@/types/database";
import { Button } from "../ui/button";

interface FacilityActivityCardProps {
  data: FacilityActivity[];
}

type ViewMode = "chart" | "table";

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#f97316",
];

function FacilityBubbleChart({ data }: { data: FacilityActivity[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 400;
    const height = 280;

    svg.attr("width", width).attr("height", height);

    const color = d3.scaleOrdinal<string>().range(COLORS);

    // Pack layout
    const root = d3
      .hierarchy({ children: data } as any)
      .sum((d: any) => d.requestCount || 1);

    const pack = d3.pack().size([width, height]).padding(4);
    pack(root as any);

    const nodes = svg
      .selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`);

    // Circles
    nodes
      .append("circle")
      .attr("r", (d: any) => d.r)
      .attr("fill", (_, i) => color(String(i)))
      .attr("fill-opacity", 0.75)
      .attr("stroke", (_, i) => color(String(i)))
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.3)
      .style("cursor", "pointer")
      .on("mouseenter", function (event: MouseEvent, d: any) {
        d3.select(this).attr("fill-opacity", 0.95).attr("stroke-width", 2);
        const fac = d.data as FacilityActivity;
        d3.select(tooltipRef.current!)
          .style("display", "block")
          .html(
            `<div class="font-medium text-xs text-nowrap">${fac.facilityName || fac.facilityCode}</div>` +
              `<div class="text-xs text-nowrap text-foreground">Requests: ${fac.requestCount.toLocaleString()}</div>` +
              `<div class="text-xs text-nowrap text-foreground">Results: ${fac.resultCount.toLocaleString()}</div>` +
              `<div class="text-xs text-nowrap text-foreground">Patients: ${fac.patientCount.toLocaleString()}</div>`,
          );
      })
      .on("mousemove", (event: MouseEvent) => {
        const rect = svgRef.current!.parentElement!.getBoundingClientRect();
        d3.select(tooltipRef.current!)
          .style("left", `${event.clientX - rect.left + 12}px`)
          .style("top", `${event.clientY - rect.top - 10}px`);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("fill-opacity", 0.75).attr("stroke-width", 1);
        d3.select(tooltipRef.current!).style("display", "none");
      });

    // Labels (only if circle is big enough)
    nodes
      .filter((d: any) => d.r > 20)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr(
        "font-size",
        (d: any) => Math.max(8, Math.min(12, d.r / 3.5)) + "px",
      )
      .attr("font-weight", "500")
      .attr("fill", "white")
      .text((d: any) => {
        const name =
          (d.data as FacilityActivity).facilityName ||
          (d.data as FacilityActivity).facilityCode;
        const maxLen = Math.floor(d.r / 4);
        return name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
      });
  }, [data]);

  return (
    <div className="relative">
      <svg ref={svgRef} className="w-full max-w-100 mx-auto" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-50 hidden rounded-lg border bg-popover px-3 py-2 shadow-md"
        style={{ display: "none" }}
      />
    </div>
  );
}

export function FacilityActivityCard({ data }: FacilityActivityCardProps) {
  const [view, setView] = useState<ViewMode>("chart");
  const sorted = [...data].sort((a, b) => b.requestCount - a.requestCount);

  return (
    <div className="h-full ">
      <div className="cursor-default border-border border bg-card rounded-sm shadow h-full relative">
        <div className="flex items-center min-h-10 max-h-10 text-xs py-2 pl-4 pr-2 border-border border-b justify-between">
          <div>FACILITY ACTIVITY</div>

          <div className="flex items-center gap-0.5 ">
            <Button
              variant="ghost"
              onClick={() => setView("chart")}
              className={cn(
                "rounded-none transition-all",
                view === "chart" ? "" : "text-muted-foreground",
              )}
            >
              <Map className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setView("table")}
              className={cn(
                "rounded-none transition-all",
                view === "table" ? "" : "text-muted-foreground",
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex p-0 w-full min-h-[calc(100%-40px)] max-h-[calc(100%-40px)]">
          {view === "chart" ? (
            <div className="flex p-2 w-full min-h-[calc(100%-40px)] max-h-[calc(100%-40px)] justify-center items-center">
              <FacilityBubbleChart data={sorted.slice(0, 20)} />
            </div>
          ) : (
            <div className="w-full min-h-[calc(100%-40px)] max-h-[calc(100%-40px)] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Facility</TableHead>
                    <TableHead className="text-[10px] text-right">
                      Requests
                    </TableHead>
                    <TableHead className="text-[10px] text-right">
                      Results
                    </TableHead>
                    <TableHead className="text-[10px] text-right">
                      Patients
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.slice(0, 15).map((fac) => (
                    <TableRow key={fac.facilityCode}>
                      <TableCell className="text-xs py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-37.5">
                            {fac.facilityName || fac.facilityCode}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {fac.countryCode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-mono">
                        {fac.requestCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-mono">
                        {fac.resultCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-mono">
                        {fac.patientCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
