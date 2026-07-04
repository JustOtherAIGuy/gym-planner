import type { ReviewCardio, ReviewSession } from "./review";

export type PhaseWindow = {
  id: string;
  phase_index: number;
  name: string;
  focus: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
};

/**
 * The phase whose date window contains today. Before the first phase returns
 * the first, after the last returns the last (so the plan page always has a
 * phase to show), null only for an empty list.
 */
export function currentPhase<P extends PhaseWindow>(
  phases: P[],
  todayISO: string,
): P | null {
  if (phases.length === 0) return null;
  const sorted = [...phases].sort((a, b) => a.phase_index - b.phase_index);
  for (const p of sorted) {
    if (todayISO >= p.start_date && todayISO <= p.end_date) return p;
  }
  if (todayISO < sorted[0]!.start_date) return sorted[0]!;
  return sorted[sorted.length - 1]!;
}

/** 1-based week number since startISO, clamped to >= 1. */
export function planWeekNumber(startISO: string, todayISO: string): number {
  const start = new Date(`${startISO}T00:00:00`);
  const today = new Date(`${todayISO}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(today.getTime())) {
    throw new RangeError("Invalid ISO date passed to planWeekNumber");
  }
  const days = Math.floor(
    (today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.max(1, Math.floor(days / 7) + 1);
}

/**
 * Total weeks a dated span covers (inclusive), minimum 1. Rounded so a
 * 13-week block whose end date is race day (one day past 13×7) stays 13.
 */
export function planTotalWeeks(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  const days =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.round(days / 7));
}

/** Local calendar date (YYYY-MM-DD) of a date-only or timestamp ISO string. */
function localDateOf(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError("Invalid ISO date passed to plan week helpers");
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Half-open window of plan week `weekIndex` (1-based), anchored to the
 * program start_date: [start + 7·(w−1), start + 7·w). Plan weeks run
 * start-day to start-day (Thu–Wed for a Thursday start), NOT Mon–Sun.
 */
export function planWeekWindow(
  startISO: string,
  weekIndex: number,
): { startISO: string; endISO: string } {
  if (weekIndex < 1) {
    throw new RangeError("weekIndex is 1-based");
  }
  const d = new Date(`${startISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError("Invalid ISO date passed to planWeekWindow");
  }
  d.setDate(d.getDate() + (weekIndex - 1) * 7);
  const start = formatLocal(d);
  d.setDate(d.getDate() + 7);
  const end = formatLocal(d);
  return { startISO: start, endISO: end };
}

function formatLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export type PlanWeekActuals = {
  weekIndex: number;
  runKm: number;
  longestRunKm: number;
  sessions: number; // completed only
  stationEfforts: number; // non-run cardio rows (ergs, sleds, carries…)
};

/**
 * What actually happened inside one plan-anchored week. Timestamps are
 * bucketed by LOCAL calendar date so a late-evening run stays in its week.
 */
export function planWeekActuals(
  inputs: { sessions: ReviewSession[]; cardio: ReviewCardio[] },
  startISO: string,
  weekIndex: number,
): PlanWeekActuals {
  const { startISO: lo, endISO: hi } = planWeekWindow(startISO, weekIndex);
  const inWindow = (iso: string) => {
    const d = localDateOf(iso);
    return d >= lo && d < hi;
  };

  const sessions = inputs.sessions.filter(
    (s) => s.ended_at !== null && inWindow(s.started_at),
  ).length;

  let runMeters = 0;
  let longestMeters = 0;
  let stationEfforts = 0;
  for (const c of inputs.cardio) {
    if (!inWindow(c.logged_at)) continue;
    if (c.kind === "run") {
      const m = c.distance_m ?? 0;
      runMeters += m;
      if (m > longestMeters) longestMeters = m;
    } else {
      stationEfforts += 1;
    }
  }

  return {
    weekIndex,
    runKm: Math.round((runMeters / 1000) * 10) / 10,
    longestRunKm: Math.round((longestMeters / 1000) * 10) / 10,
    sessions,
    stationEfforts,
  };
}
