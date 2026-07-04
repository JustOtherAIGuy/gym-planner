import { epleyOneRepMax } from "./oneRepMax";

export type LoggedSet = {
  reps: number;
  weightKg: number;
  isWarmup: boolean;
};

/**
 * The one deterministic rule for the "actual" line on progress charts:
 * best e1RM among non-warmup sets with reps <= 12, one point per session.
 * Epley drifts as reps climb and warmups aren't maximal effort — including
 * either makes the chart jumpy and misleading. The cap is 12 (not 10)
 * because the app's default programming range is 8-12; a stricter cap would
 * leave typical hypertrophy sessions off the chart entirely.
 *
 * Returns null when the session has no qualifying set.
 */
export function sessionE1RM(sets: LoggedSet[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (s.isWarmup || s.reps < 1 || s.reps > 12 || s.weightKg <= 0) continue;
    const e = epleyOneRepMax(s.weightKg, s.reps);
    if (best === null || e > best) best = e;
  }
  return best;
}
