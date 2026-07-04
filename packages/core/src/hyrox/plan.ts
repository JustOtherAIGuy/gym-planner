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
