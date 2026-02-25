import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { cn } from "@/lib/utils";
import type { StorageOverview as StorageOverviewType } from "@/types/database";

interface StorageOverviewProps {
  storage: StorageOverviewType;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
  );
}

const TREEMAP_COLORS = [
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

function BucketTreemap({
  buckets,
}: {
  buckets: StorageOverviewType["buckets"];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || buckets.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 320;
    const height = 160;

    svg.attr("width", width).attr("height", height);

    const root = d3
      .hierarchy({
        children: buckets.map((b) => ({
          ...b,
          value: Math.max(b.sizeBytes, 1),
        })),
      })
      .sum((d: any) => d.value || 0);

    d3
      .treemap()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(2)
      .round(true)(root as any);

    const color = d3.scaleOrdinal<string>().range(TREEMAP_COLORS);

    const leaves = svg
      .selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", (d: any) => `translate(${d.x0},${d.y0})`);

    leaves
      .append("rect")
      .attr("width", (d: any) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d: any) => Math.max(0, d.y1 - d.y0))
      .attr("rx", 3)
      .attr("fill", (_, i) => color(String(i)))
      .attr("opacity", 0.8)
      .style("cursor", "pointer")
      .on("mouseenter", function (event: MouseEvent, d: any) {
        d3.select(this).attr("opacity", 1);
        d3.select(tooltipRef.current!)
          .style("display", "block")
          .html(
            `<div class="font-medium text-xs">${d.data.name}</div>` +
              `<div class="text-xs text-muted-foreground">${formatBytes(d.data.sizeBytes)}</div>` +
              `<div class="text-xs text-muted-foreground">${d.data.objectCount.toLocaleString()} objects</div>`,
          );
      })
      .on("mousemove", (event: MouseEvent) => {
        const rect = svgRef.current!.parentElement!.getBoundingClientRect();
        d3.select(tooltipRef.current!)
          .style("left", `${event.clientX - rect.left + 12}px`)
          .style("top", `${event.clientY - rect.top - 10}px`);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", 0.8);
        d3.select(tooltipRef.current!).style("display", "none");
      });

    // Labels (only if cell is big enough)
    leaves
      .filter((d: any) => d.x1 - d.x0 > 50 && d.y1 - d.y0 > 24)
      .append("text")
      .attr("x", 6)
      .attr("y", 16)
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("fill", "white")
      .text((d: any) => {
        const name = d.data.name;
        const maxLen = Math.floor((d.x1 - d.x0 - 12) / 6);
        return name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
      });
  }, [buckets]);

  return (
    <div className="relative">
      <svg ref={svgRef} className="w-full max-w-[320px]" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-50 hidden rounded-lg border bg-popover px-3 py-2 shadow-md"
        style={{ display: "none" }}
      />
    </div>
  );
}

export function StorageOverviewCard({ storage }: StorageOverviewProps) {
  const usagePercent =
    storage.totalSizeBytes > 0
      ? (storage.usedSizeBytes / storage.totalSizeBytes) * 100
      : 0;

  return (
    <div className="h-full ">
      <div className="cursor-default border-border border bg-card rounded-sm shadow h-full">
        <div className="flex items-center min-h-10 max-h-10 text-xs py-2 px-4 border-border border-b">
          STORAGE
        </div>
        <div className="w-full min-h-[calc(100%-40px)] max-h-[calc(100%-40px)] space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 rounded-sm border m-2">
            <div className="flex flex-col items-center justify-center p-2">
              <div className="text-md font-semibold leading-none">
                {storage.totalBuckets}
              </div>
              <div className="text-[10px] text-muted-foreground ">Buckets</div>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-r">
              <div className="text-md font-semibold leading-none">
                {storage.totalObjects.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground">Objects</div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="text-md font-semibold leading-none">
                {formatBytes(storage.usedSizeBytes)}
              </div>
              <div className="text-[10px] text-muted-foreground">Used</div>
            </div>
          </div>

          {/* Usage bar */}
          {storage.totalSizeBytes > 0 && (
            <div className="border-b p-2">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Storage Usage</span>
                <span>{usagePercent.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-xs transition-all duration-500",
                    usagePercent > 90
                      ? "bg-red-500"
                      : usagePercent > 70
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{formatBytes(storage.usedSizeBytes)}</span>
                <span>{formatBytes(storage.totalSizeBytes)}</span>
              </div>
            </div>
          )}

          {/* Bucket treemap */}
          {storage.buckets.length > 0 && (
            <div className="px-2 pb-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Bucket Sizes
              </p>
              <BucketTreemap buckets={storage.buckets} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
