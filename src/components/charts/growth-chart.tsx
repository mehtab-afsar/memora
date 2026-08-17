"use client";

import { useMemo, useRef, useState } from "react";

const WIDTH = 640;
const HEIGHT = 180;
const PAD_LEFT = 32;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const RANGE_DAYS = 30;

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function GrowthChart({ data }: { data: { day: string; count: number }[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = useMemo(() => {
    const byDay = new Map(data.map((d) => [d.day, d.count]));
    const days: { day: string; count: number }[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = RANGE_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ day: iso, count: byDay.get(iso) ?? 0 });
    }
    return days;
  }, [data]);

  const max = niceMax(Math.max(...series.map((d) => d.count), 1));
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) => PAD_LEFT + (i / (series.length - 1)) * plotW;
  const yFor = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  const linePath = series.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(d.count)}`).join(" ");
  const areaPath = `${linePath} L${xFor(series.length - 1)},${PAD_TOP + plotH} L${xFor(0)},${PAD_TOP + plotH} Z`;

  const yTicks = [0, max / 2, max];

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const idx = Math.round(((relX - PAD_LEFT) / plotW) * (series.length - 1));
    setHoverIndex(Math.min(Math.max(idx, 0), series.length - 1));
  };

  const hovered = hoverIndex !== null ? series[hoverIndex] : null;
  const total = series.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No memories created in the last 30 days.</p>;
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Memories created per day, last 30 days"
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke="var(--viz-grid)"
              strokeWidth={1}
            />
            <text x={PAD_LEFT - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[9px] tabular-nums">
              {Math.round(t)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="var(--primary)" opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <text x={xFor(0)} y={HEIGHT - 6} textAnchor="start" className="fill-muted-foreground text-[9px]">
          {formatDay(series[0].day)}
        </text>
        <text x={xFor(series.length - 1)} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {formatDay(series[series.length - 1].day)}
        </text>

        {hoverIndex !== null && (
          <>
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke="var(--viz-axis)"
              strokeWidth={1}
            />
            <circle
              cx={xFor(hoverIndex)}
              cy={yFor(series[hoverIndex].count)}
              r={4}
              fill="var(--primary)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      {hovered && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${(xFor(hoverIndex) / WIDTH) * 100}%` }}
        >
          <div className="font-semibold tabular-nums text-popover-foreground">{hovered.count}</div>
          <div className="text-muted-foreground">{formatDay(hovered.day)}</div>
        </div>
      )}
    </div>
  );
}
