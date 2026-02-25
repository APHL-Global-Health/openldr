import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { TestPanelVolume } from "@/types/database";

interface TestPanelBarChartProps {
  data: TestPanelVolume[];
  maxItems?: number;
}

const MARGIN = { top: 8, right: 50, bottom: 8, left: 120 };

export function TestPanelBarChart({
  data,
  maxItems = 10,
}: TestPanelBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, maxItems);
  const barHeight = 28;
  const gap = 4;
  const height = MARGIN.top + MARGIN.bottom + sorted.length * (barHeight + gap);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.max(300, entries[0].contentRect.width));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || sorted.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const innerW = width - MARGIN.left - MARGIN.right;

    const g = svg
      .attr("width", width)
      .attr("height", height + 40)
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(sorted, (d) => d.count) || 1])
      .range([0, innerW]);

    const y = d3
      .scaleBand()
      .domain(sorted.map((d) => d.panelCode))
      .range([0, sorted.length * (barHeight + gap)])
      .padding(0.15);

    // Gradient
    const defs = svg.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", "bar-grad")
      .attr("x1", "0")
      .attr("y1", "0")
      .attr("x2", "1")
      .attr("y2", "0");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#6366f1");

    // Background bars
    g.selectAll(".bg-bar")
      .data(sorted)
      .join("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.panelCode) || 0)
      .attr("width", innerW)
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", "currentColor")
      .attr("opacity", 0.04);

    // Value bars
    g.selectAll(".bar")
      .data(sorted)
      .join("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.panelCode) || 0)
      .attr("width", 0)
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", "url(#bar-grad)")
      .style("cursor", "pointer")
      .on("mouseenter", function (event: MouseEvent, d) {
        d3.select(this).attr("opacity", 0.85);
        d3.select(tooltipRef.current!)
          .style("display", "block")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 10}px`)
          .html(
            `<div class="font-medium text-xs">${d.panelDesc || d.panelCode}</div>` +
              `<div class="text-xs text-foreground">${d.count.toLocaleString()} tests</div>`,
          );
      })
      .on("mousemove", (event: MouseEvent) => {
        d3.select(tooltipRef.current!)
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 10}px`);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", 1);
        d3.select(tooltipRef.current!).style("display", "none");
      })
      .transition()
      .duration(600)
      .delay((_, i) => i * 40)
      .ease(d3.easeCubicOut)
      .attr("width", (d) => x(d.count));

    // Labels (left)
    g.selectAll(".label")
      .data(sorted)
      .join("text")
      .attr("x", -8)
      .attr("y", (d) => (y(d.panelCode) || 0) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("fill", "currentColor")
      .attr("opacity", 0.6)
      .text((d) => {
        const label = d.panelDesc || d.panelCode;
        return label.length > 16 ? label.slice(0, 15) + "…" : label;
      });

    // Value labels (right of bar)
    g.selectAll(".value")
      .data(sorted)
      .join("text")
      .attr("x", (d) => x(d.count) + 6)
      .attr("y", (d) => (y(d.panelCode) || 0) + y.bandwidth() / 2)
      .attr("dominant-baseline", "central")
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("fill", "currentColor")
      .attr("opacity", 0)
      .text((d) => d.count.toLocaleString())
      .transition()
      .duration(600)
      .delay((_, i) => i * 40 + 300)
      .attr("opacity", 0.5);
  }, [sorted, width, height]);

  return (
    <div className="h-full ">
      <div className="cursor-default border-border border bg-card rounded-sm shadow h-full">
        <div className="flex items-center min-h-10 max-h-10 text-xs py-2 px-4 border-border border-b">
          TEST PANELS
        </div>
        <div className="p-0 w-full min-h-[calc(100%-40px)] max-h-[calc(100%-40px)] items-center flex relative">
          <div ref={containerRef} className="relative w-full mt-6 flex">
            <svg ref={svgRef} className="w-full " />
            <div
              ref={tooltipRef}
              className="pointer-events-none absolute z-50 hidden rounded-lg border bg-popover px-3 py-2 shadow-md"
              style={{ display: "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
