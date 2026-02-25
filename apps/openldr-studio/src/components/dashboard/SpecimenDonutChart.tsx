import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { SpecimenTypeCount } from "@/types/database";

interface SpecimenDonutChartProps {
  data: SpecimenTypeCount[];
}

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
  "#84cc16",
  "#a855f7",
];

export function SpecimenDonutChart({ data }: SpecimenDonutChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const size = 220;
  const radius = size / 2;
  const innerRadius = radius * 0.58;

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr("width", size)
      .attr("height", size)
      .append("g")
      .attr("transform", `translate(${radius},${radius})`);

    const color = d3
      .scaleOrdinal<string>()
      .domain(data.map((d) => d.specimenType))
      .range(COLORS);

    const pie = d3
      .pie<SpecimenTypeCount>()
      .value((d) => d.count)
      .sort(null)
      .padAngle(0.02);

    const arc = d3
      .arc<d3.PieArcDatum<SpecimenTypeCount>>()
      .innerRadius(innerRadius)
      .outerRadius(radius - 4)
      .cornerRadius(3);

    const arcHover = d3
      .arc<d3.PieArcDatum<SpecimenTypeCount>>()
      .innerRadius(innerRadius - 2)
      .outerRadius(radius)
      .cornerRadius(3);

    const arcs = g
      .selectAll(".arc")
      .data(pie(data))
      .join("g")
      .attr("class", "arc");

    arcs
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => color(d.data.specimenType))
      // .attr("stroke", "var(--background, white)")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .style("transition", "opacity 150ms")
      .on("mouseenter", function (event: MouseEvent, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("d", arcHover as any);
        setActiveIndex(d.index);

        const tooltip = d3.select(tooltipRef.current!);
        tooltip
          .style("display", "block")
          .style("background", "var(--background-card))")
          .html(
            `<div class="font-medium text-xs">${d.data.label}</div>` +
              `<div class="text-xs">${d.data.count.toLocaleString()} (${d.data.percentage.toFixed(1)}%)</div>`,
          );
      })
      .on("mousemove", (event: MouseEvent) => {
        const tooltip = d3.select(tooltipRef.current!);
        const rect = svgRef.current!.parentElement!.getBoundingClientRect();
        tooltip
          .style("left", `${event.clientX - rect.left + 12}px`)
          .style("top", `${event.clientY - rect.top - 10}px`);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("d", arc as any);
        setActiveIndex(null);
        d3.select(tooltipRef.current!).style("display", "none");
      });

    // Center text
    const total = d3.sum(data, (d) => d.count);
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.3em")
      .attr("class", "fill-current text-foreground")
      .attr("font-size", "20px")
      .attr("font-weight", "600")
      .text(total >= 1000 ? `${(total / 1000).toFixed(1)}K` : total.toString());

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("class", "fill-current text-muted-foreground")
      .attr("font-size", "10px")
      .text("Specimens");
  }, [data, size]);

  return (
    <div>
      <div className="flex items-center min-h-10 max-h-10 text-xs py-2 px-4 border-border border-b">
        SPECIMEN DISTRIBUTION
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
          {data.slice(0, 8).map((item, i) => (
            <div
              key={item.specimenType}
              className="flex items-center gap-1.5 text-xs transition-opacity"
              style={{
                opacity: activeIndex !== null && activeIndex !== i ? 0.35 : 1,
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground truncate max-w-25">
                {item.label}
              </span>
            </div>
          ))}
          {data.length > 8 && (
            <span className="text-xs text-muted-foreground">
              +{data.length - 8} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
