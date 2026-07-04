"use client";

import { useId } from "react";

export type Series = {
  points: { x: number; y: number }[];
  color: string;
  dashed?: boolean;
  dots?: boolean;
  /** Volt gradient fill under the line + glow — the "actual" line. */
  area?: boolean;
  label?: string;
};

export type Marker = { x: number; label: string };

/**
 * Dependency-free SVG line chart. Datasets here are tiny (≤ a few hundred
 * points), and owning the renderer keeps the forecast-overlay styling exact —
 * it is also the substrate for AI-requested charts later (chart-spec → SVG).
 */
export function LineChart({
  series,
  markers = [],
  height = 180,
  yUnit = "",
  todayX,
}: {
  series: Series[];
  markers?: Marker[];
  height?: number;
  yUnit?: string;
  todayX?: number;
}) {
  const gradientId = useId();
  const W = 360;
  const H = height;
  const PAD = { l: 34, r: 10, t: 10, b: 20 };

  const all = series.flatMap((s) => s.points);
  if (all.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-line text-sm text-faint"
        style={{ height: H }}
      >
        No data yet
      </div>
    );
  }

  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs, xMin + 1);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  const yPad = Math.max(ySpread * 0.15, 2);
  const yMin = Math.min(...ys) - yPad;
  const yMax = Math.max(...ys) + yPad;

  const sx = (x: number) =>
    PAD.l + ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const sy = (y: number) =>
    H - PAD.b - ((y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  const path = (pts: { x: number; y: number }[]) =>
    pts
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`,
      )
      .join(" ");

  const areaPath = (pts: { x: number; y: number }[]) =>
    `${path(pts)} L${sx(pts[pts.length - 1]!.x).toFixed(1)},${H - PAD.b} L${sx(
      pts[0]!.x,
    ).toFixed(1)},${H - PAD.b} Z`;

  // Dedupe: with a single data point (or zero spread) all three candidates
  // collapse to the same value, which would render duplicate React keys.
  const yTicks = [
    ...new Set([yMin + yPad, (yMin + yMax) / 2, yMax - yPad]),
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="chart"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfff38" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#bfff38" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={sy(t)}
            y2={sy(t)}
            stroke="rgba(255,255,255,0.06)"
          />
          <text
            x={PAD.l - 4}
            y={sy(t) + 3}
            textAnchor="end"
            fontSize="9"
            fill="var(--color-faint)"
          >
            {Math.round(t)}
            {yUnit}
          </text>
        </g>
      ))}

      {todayX !== undefined && todayX >= xMin && todayX <= xMax && (
        <line
          x1={sx(todayX)}
          x2={sx(todayX)}
          y1={PAD.t}
          y2={H - PAD.b}
          stroke="rgba(255,255,255,0.22)"
          strokeDasharray="2 3"
        />
      )}

      {markers.map((m) =>
        m.x >= xMin && m.x <= xMax ? (
          <g key={`${m.x}-${m.label}`}>
            <line
              x1={sx(m.x)}
              x2={sx(m.x)}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="rgba(191,255,56,0.15)"
            />
            <text
              x={sx(m.x)}
              y={H - PAD.b + 12}
              textAnchor="middle"
              fontSize="8"
              fill="var(--color-faint)"
            >
              {m.label}
            </text>
          </g>
        ) : null,
      )}

      {series.map((s, i) => (
        <g key={i}>
          {s.area && s.points.length > 1 && (
            <path d={areaPath(s.points)} fill={`url(#${gradientId})`} />
          )}
          {s.points.length > 1 && (
            <path
              d={path(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1200}
              style={
                s.area
                  ? {
                      filter: "drop-shadow(0 0 6px rgba(191,255,56,0.45))",
                      strokeDasharray: s.dashed ? undefined : 1200,
                      animation: s.dashed
                        ? undefined
                        : "draw-line 0.9s ease-out forwards",
                    }
                  : undefined
              }
            />
          )}
          {s.dots &&
            s.points.map((p, j) => (
              <circle
                key={j}
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={2.5}
                fill={s.color}
              />
            ))}
        </g>
      ))}
    </svg>
  );
}
