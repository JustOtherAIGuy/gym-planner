"use client";

import { planTotalWeeks } from "@gym-planner/core/hyrox";
import type { TProgramPhase } from "@gym-planner/core/schemas";

/** Segmented horizontal plan timeline: one segment per phase, sized by its
 * length in weeks, with a marker at today's position. */
export function PhaseTimeline({
  phases,
  todayISO,
}: {
  phases: TProgramPhase[];
  todayISO: string;
}) {
  if (phases.length === 0) return null;
  const sorted = [...phases].sort((a, b) => a.phase_index - b.phase_index);
  const startMs = Date.parse(`${sorted[0]!.start_date}T00:00:00`);
  const endMs = Date.parse(`${sorted[sorted.length - 1]!.end_date}T00:00:00`);
  const nowMs = Date.parse(`${todayISO}T00:00:00`);
  const frac = Math.min(1, Math.max(0, (nowMs - startMs) / (endMs - startMs)));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative flex h-2.5 gap-0.5">
        {sorted.map((p) => {
          const weeks = planTotalWeeks(p.start_date, p.end_date);
          const active =
            todayISO >= p.start_date && todayISO <= p.end_date;
          const past = todayISO > p.end_date;
          return (
            <div
              key={p.id}
              className={`h-full rounded-full ${
                active
                  ? "bg-accent shadow-glow-sm"
                  : past
                    ? "bg-accent/40"
                    : "bg-surface-2"
              }`}
              style={{ flexGrow: weeks }}
            />
          );
        })}
        {/* today tick */}
        <span
          aria-hidden
          className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-fg"
          style={{ left: `${frac * 100}%` }}
        />
      </div>
      <div className="flex gap-0.5">
        {sorted.map((p) => {
          const weeks = planTotalWeeks(p.start_date, p.end_date);
          const active = todayISO >= p.start_date && todayISO <= p.end_date;
          return (
            <span
              key={p.id}
              className={`truncate text-[9px] ${
                active ? "font-bold text-accent" : "text-faint"
              }`}
              style={{ flexGrow: weeks, flexBasis: 0 }}
            >
              {p.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
