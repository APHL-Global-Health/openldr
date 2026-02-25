import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ResultFlagCount } from "@/types/database";

interface ResultFlagChartProps {
  data: ResultFlagCount[];
}

export function ResultFlagChart({ data }: ResultFlagChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 16;
  const innerR = outerR * 0.42;

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const total = d3.sum(data, (d) => d.count);
    if (total === 0) return;

    const g = svg
      .attr("width", size)
      .attr("height", size)
      .append("g")
      .attr("transform", `translate(${cx},${cy})`);

    const pie = d3
      .pie<ResultFlagCount>()
      .value((d) => d.count)
      .sort(null)
      .padAngle(0.03);

    const arc = d3
      .arc<d3.PieArcDatum<ResultFlagCount>>()
      .innerRadius(innerR)
      .outerRadius(outerR)
      .cornerRadius(4);

    const arcHover = d3
      .arc<d3.PieArcDatum<ResultFlagCount>>()
      .innerRadius(innerR - 2)
      .outerRadius(outerR + 4)
      .cornerRadius(4);

    const arcs = g
      .selectAll(".arc")
      .data(pie(data))
      .join("g")
      .attr("class", "arc");

    arcs
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => d.data.color)
      // .attr("stroke", "var(--background, white)")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseenter", function (event: MouseEvent, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("d", arcHover as any);
        const pct = ((d.data.count / total) * 100).toFixed(1);
        d3.select(tooltipRef.current!)
          .style("display", "block")
          .style("background", "var(--background-card))")
          .html(
            `<div class="flex items-center gap-1.5 text-xs font-medium">` +
              `<span class="inline-block h-2 w-2 rounded-full" style="background:${d.data.color}"></span>` +
              `${d.data.label}</div>` +
              `<div class="text-xs">${d.data.count.toLocaleString()} (${pct}%)</div>`,
          );
      })
      .on("mousemove", (event: MouseEvent) => {
        const rect = svgRef.current!.parentElement!.getBoundingClientRect();
        d3.select(tooltipRef.current!)
          .style("left", `${event.clientX - rect.left + 12}px`)
          .style("top", `${event.clientY - rect.top - 10}px`);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("d", arc as any);
        d3.select(tooltipRef.current!).style("display", "none");
      });

    // Percentage labels on arcs (for larger segments)
    arcs
      .filter((d) => d.data.count / total > 0.08)
      .append("text")
      .attr("transform", (d) => `translate(${arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("fill", "white")
      .text((d) => `${((d.data.count / total) * 100).toFixed(0)}%`);

    // Center total
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("font-size", "18px")
      .attr("font-weight", "600")
      .attr("fill", "currentColor")
      .text(total >= 1000 ? `${(total / 1000).toFixed(1)}K` : total.toString());

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.3em")
      .attr("font-size", "9px")
      .attr("fill", "currentColor")
      .attr("opacity", 0.45)
      .text("Results");
  }, [data, size]);

  return (
    <div>
      <div className="flex items-center min-h-10 max-h-10 text-xs py-2 px-4 border-border border-b">
        RESULT FLAGS
      </div>
      <div className="flex flex-1 flex-col items-center gap-4 pt-0">
        <div className="relative">
          <svg ref={svgRef} />
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-50 hidden rounded-lg border bg-popover px-3 py-2 shadow-md"
            style={{ display: "none" }}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-2">
          {data.map((item) => (
            <div key={item.flag} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
