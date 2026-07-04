"use client";

import { formatMS, HYROX_LEGS } from "@gym-planner/core/hyrox";
import type { TRaceSplit } from "@gym-planner/core/schemas";
import { GlyphNested, type GlyphName } from "./pictograms/glyphs";
import { resolveGlyph } from "./pictograms/map";

// Station legs in race order (odd leg indexes 1..15).
const STATION_GLYPHS: GlyphName[] = HYROX_LEGS.filter(
  (l) => l.kind === "station",
).map((l) =>
  l.cardio_kind ? resolveGlyph({ kind: l.cardio_kind }) : "wallball",
);

// Snake layout: row 1 left→right, U-turn, row 2 right→left, finish flag.
const ROW1_X = [70, 160, 250, 340];
const ROW2_X = [340, 250, 160, 70];
const Y1 = 38;
const Y2 = 108;
const NODE_R = 15;

// Midpoints of the 8 run segments, in leg order (0,2,4,…,14).
const RUN_POS: { x: number; y: number }[] = [
  { x: 36, y: Y1 },
  { x: 115, y: Y1 },
  { x: 205, y: Y1 },
  { x: 295, y: Y1 },
  { x: 372, y: (Y1 + Y2) / 2 }, // the U-turn run
  { x: 295, y: Y2 },
  { x: 205, y: Y2 },
  { x: 115, y: Y2 },
];

/**
 * The HYROX course as a journey: 8 dashed 1 km runs snaking through the
 * 8 station nodes to the finish flag. With splits, every leg gets its time.
 */
export function RaceCourseStrip({ splits }: { splits?: TRaceSplit[] }) {
  const splitByLeg = new Map<number, number>();
  for (const s of splits ?? []) splitByLeg.set(s.leg_index, s.duration_sec);
  const hasSplits = splitByLeg.size > 0;

  const runLabel = (runIdx: number) => {
    const legIndex = runIdx * 2;
    const sec = splitByLeg.get(legIndex);
    return sec ? formatMS(sec) : "1 km";
  };

  return (
    <svg viewBox="0 0 400 150" className="w-full" role="img" aria-label="HYROX course">
      {/* the route */}
      <path
        d={`M10 ${Y1} H352 C388 ${Y1} 388 ${Y2} 352 ${Y2} H24`}
        fill="none"
        stroke="var(--color-accent)"
        strokeOpacity={0.45}
        strokeWidth={2}
        strokeDasharray="5 6"
        strokeLinecap="round"
      />

      {/* start dot */}
      <circle cx={10} cy={Y1} r={3.5} fill="var(--color-accent)" />

      {/* finish flag */}
      <g stroke="var(--color-fg)" strokeWidth={2} fill="none" strokeLinecap="round">
        <path d={`M16 ${Y2 + 10} V${Y2 - 12}`} />
        <path
          d={`M16 ${Y2 - 12} h11 l-3.5 4 3.5 4 h-11`}
          fill="var(--color-accent)"
          stroke="none"
        />
      </g>

      {/* run labels */}
      {RUN_POS.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={i === 4 ? p.y + 3 : p.y - 24}
          textAnchor="middle"
          className={`text-[9px] tabular-nums ${
            hasSplits && splitByLeg.has(i * 2)
              ? "fill-[#bfff38] font-bold"
              : "fill-[rgba(155,155,164,0.7)]"
          }`}
        >
          {runLabel(i)}
        </text>
      ))}

      {/* station nodes */}
      {STATION_GLYPHS.map((glyph, i) => {
        const row1 = i < 4;
        const x = row1 ? ROW1_X[i]! : ROW2_X[i - 4]!;
        const y = row1 ? Y1 : Y2;
        const legIndex = i * 2 + 1;
        const split = splitByLeg.get(legIndex);
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={NODE_R}
              fill="var(--color-surface-2)"
              stroke="var(--color-line-strong)"
              strokeWidth={1.2}
            />
            <GlyphNested
              name={glyph}
              x={x - 9}
              y={y - 9}
              size={18}
              stroke="var(--color-accent)"
            />
            {split !== undefined && (
              <text
                x={x}
                y={y + NODE_R + 11}
                textAnchor="middle"
                className="fill-[#bfff38] text-[9px] font-bold tabular-nums"
              >
                {formatMS(split)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
