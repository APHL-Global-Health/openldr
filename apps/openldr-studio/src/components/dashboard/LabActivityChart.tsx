import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { LabActivityPoint } from "@/types/database";

interface LabActivityChartProps {
  data: LabActivityPoint[];
}

const MARGIN = { top: 20, right: 24, bottom: 40, left: 48 };

export function LabActivityChart({ data }: LabActivityChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 280 });

  // Responsive resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width: Math.max(300, width), height: 280 });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // D3 render
  useEffect(() => {
    if (!svgRef.current || !tooltipRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Parse dates
    const parsed = data.map((d) => ({
      date: new Date(d.timestamp),
      requests: d.requests,
      results: d.results,
    }));

    // Scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(parsed, (d) => d.date) as [Date, Date])
      .range([0, innerW]);

    const maxY = d3.max(parsed, (d) => Math.max(d.requests, d.results)) || 1;
    const y = d3
      .scaleLinear()
      .domain([0, maxY * 1.1])
      .range([innerH, 0])
      .nice();

    // Grid lines
    g.append("g")
      .attr("class", "grid-lines")
      .selectAll("line")
      .data(y.ticks(5))
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.06);

    // Axes
    const xAxis = g
      .append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(d3.timeHour.every(4) || 6)
          .tickFormat((d) =>
            d3.timeFormat(innerW > 500 ? "%b %d %H:%M" : "%H:%M")(d as Date),
          )
          .tickSizeOuter(0),
      );

    xAxis
      .selectAll("text")
      .attr("font-size", "10px")
      .attr("fill", "currentColor")
      .attr("opacity", 0.5);
    xAxis.selectAll("line").attr("stroke", "currentColor").attr("opacity", 0.1);
    xAxis.select(".domain").attr("stroke", "currentColor").attr("opacity", 0.1);

    const yAxis = g
      .append("g")
      .call(
        d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")).tickSizeOuter(0),
      );

    yAxis
      .selectAll("text")
      .attr("font-size", "10px")
      .attr("fill", "currentColor")
      .attr("opacity", 0.5);
    yAxis.selectAll("line").attr("stroke", "currentColor").attr("opacity", 0.1);
    yAxis.select(".domain").attr("stroke", "currentColor").attr("opacity", 0.1);

    // Gradient defs
    const defs = svg.append("defs");

    const makeGrad = (id: string, color: string) => {
      const grad = defs
        .append("linearGradient")
        .attr("id", id)
        .attr("x1", "0")
        .attr("y1", "0")
        .attr("x2", "0")
        .attr("y2", "1");
      grad
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", color)
        .attr("stop-opacity", 0.25);
      grad
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", color)
        .attr("stop-opacity", 0.02);
    };

    makeGrad("req-grad", "#3b82f6");
    makeGrad("res-grad", "#8b5cf6");

    // Area generators
    const reqArea = d3
      .area<(typeof parsed)[0]>()
      .x((d) => x(d.date))
      .y0(innerH)
      .y1((d) => y(d.requests))
      .curve(d3.curveMonotoneX);

    const resArea = d3
      .area<(typeof parsed)[0]>()
      .x((d) => x(d.date))
      .y0(innerH)
      .y1((d) => y(d.results))
      .curve(d3.curveMonotoneX);

    // Line generators
    const reqLine = d3
      .line<(typeof parsed)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.requests))
      .curve(d3.curveMonotoneX);

    const resLine = d3
      .line<(typeof parsed)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.results))
      .curve(d3.curveMonotoneX);

    // Draw areas
    g.append("path")
      .datum(parsed)
      .attr("d", reqArea)
      .attr("fill", "url(#req-grad)");

    g.append("path")
      .datum(parsed)
      .attr("d", resArea)
      .attr("fill", "url(#res-grad)");

    // Draw lines
    g.append("path")
      .datum(parsed)
      .attr("d", reqLine)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2);

    g.append("path")
      .datum(parsed)
      .attr("d", resLine)
      .attr("fill", "none")
      .attr("stroke", "#8b5cf6")
      .attr("stroke-width", 2);

    // Interactive overlay
    const bisect = d3.bisector<(typeof parsed)[0], Date>((d) => d.date).left;

    const focusLine = g
      .append("line")
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.15)
      .attr("stroke-dasharray", "4,4")
      .style("display", "none");

    const focusDotReq = g
      .append("circle")
      .attr("r", 4)
      .attr("fill", "#3b82f6")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("display", "none");

    const focusDotRes = g
      .append("circle")
      .attr("r", 4)
      .attr("fill", "#8b5cf6")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("display", "none");

    g.append("rect")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .on("mousemove", (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const date = x.invert(mx);
        const idx = Math.min(bisect(parsed, date), parsed.length - 1);
        const d = parsed[idx];

        focusLine
          .attr("x1", x(d.date))
          .attr("x2", x(d.date))
          .style("display", null);
        focusDotReq
          .attr("cx", x(d.date))
          .attr("cy", y(d.requests))
          .style("display", null);
        focusDotRes
          .attr("cx", x(d.date))
          .attr("cy", y(d.results))
          .style("display", null);

        tooltip
          .style("display", "block")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 10}px`)
          .html(
            `<div class="text-xs font-medium mb-1">${d3.timeFormat("%b %d, %H:%M")(d.date)}</div>` +
              `<div class="flex items-center gap-1.5 text-xs"><span class="inline-block h-2 w-2 rounded-full bg-blue-500"></span>Requests: <strong>${d.requests.toLocaleString()}</strong></div>` +
              `<div class="flex items-center gap-1.5 text-xs"><span class="inline-block h-2 w-2 rounded-full bg-violet-500"></span>Results: <strong>${d.results.toLocaleString()}</strong></div>`,
          );
      })
      .on("mouseleave", () => {
        focusLine.style("display", "none");
        focusDotReq.style("display", "none");
        focusDotRes.style("display", "none");
        tooltip.style("display", "none");
      });
  }, [data, dimensions]);

  return (
    <div className="border-border border bg-card rounded-sm shadow w-full h-full relative">
      <div className="flex items-center min-h-10 max-h-10 text-xs py-2 px-4 border-border border-b">
        LAB ACTIVITY
      </div>
      <div
        ref={containerRef}
        className="flex relative h-full w-full px-2 pb-2 items-center "
      >
        <svg ref={svgRef} className="w-full" />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-50 hidden rounded-lg border bg-popover px-3 py-2 shadow-md"
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
