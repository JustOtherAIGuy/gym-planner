import { paceSecPerKm } from "./pace";
import { startOfWeekMonday } from "./weekly";

/**
 * Week review — one Monday-keyed slice of EVERYTHING the app tracks
 * (sessions, strength sets, runs, ergs/stations, nutrition, steps, weight),
 * plus the deterministic "what to aim for next week" rules.
 */

export type ReviewSession = { started_at: string; ended_at: string | null };
export type ReviewSet = {
  completed_at: string;
  reps: number;
  weight_kg: number | string;
  is_warmup: boolean;
};
export type ReviewCardio = {
  kind: string;
  distance_m: number | null;
  duration_sec: number | null;
  logged_at: string;
};
export type ReviewDaily = {
  logged_at: string;
  protein_g: number | null;
  calories: number | null;
  steps: number | null;
};
export type ReviewWeight = { logged_at: string; weight_kg: number | string };

export type ReviewInputs = {
  sessions: ReviewSession[];
  sets: ReviewSet[];
  cardio: ReviewCardio[];
  daily: ReviewDaily[];
  weights: ReviewWeight[];
  /** Protein floor in grams (a day at or above it counts as a hit). */
  proteinFloorG?: number | null;
};

export type WeekSlice = {
  weekStartISO: string; // Monday, YYYY-MM-DD
  sessions: number; // completed workouts
  sets: number; // non-warmup strength sets
  volumeKg: number; // Σ weight × reps over those sets
  runKm: number;
  runPaceSecPerKm: number | null;
  stationEfforts: number; // non-run cardio_logs rows (ergs, sleds, carries…)
  proteinDaysHit: number;
  proteinDaysLogged: number;
  avgSteps: number | null;
  avgKcal: number | null;
  avgWeightKg: number | null;
};

/** Monday of the week containing dateISO, shifted by offsetWeeks. */
export function weekStartWithOffset(
  dateISO: string,
  offsetWeeks: number,
): string {
  const monday = startOfWeekMonday(dateISO);
  const d = new Date(`${monday}T00:00:00`);
  d.setDate(d.getDate() + offsetWeeks * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function inWeek(dateOrTs: string, weekStartISO: string): boolean {
  return startOfWeekMonday(dateOrTs) === weekStartISO;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, v) => a + v, 0) / values.length;
}

/** Aggregate one Monday-keyed week across every tracked activity. */
export function weekSlice(
  inputs: ReviewInputs,
  weekStartISO: string,
): WeekSlice {
  const sessions = inputs.sessions.filter(
    (s) => s.ended_at !== null && inWeek(s.started_at, weekStartISO),
  ).length;

  let sets = 0;
  let volumeKg = 0;
  for (const s of inputs.sets) {
    if (s.is_warmup || !inWeek(s.completed_at, weekStartISO)) continue;
    sets += 1;
    volumeKg += Number(s.weight_kg) * s.reps;
  }

  let runMeters = 0;
  let paceSec = 0;
  let paceMeters = 0;
  let stationEfforts = 0;
  for (const c of inputs.cardio) {
    if (!inWeek(c.logged_at, weekStartISO)) continue;
    if (c.kind === "run") {
      runMeters += c.distance_m ?? 0;
      if (c.distance_m && c.duration_sec) {
        paceMeters += c.distance_m;
        paceSec += c.duration_sec;
      }
    } else {
      stationEfforts += 1;
    }
  }

  const floor = inputs.proteinFloorG ?? null;
  let proteinDaysHit = 0;
  let proteinDaysLogged = 0;
  const stepsVals: number[] = [];
  const kcalVals: number[] = [];
  for (const d of inputs.daily) {
    if (!inWeek(d.logged_at, weekStartISO)) continue;
    if (d.protein_g != null) {
      proteinDaysLogged += 1;
      if (floor != null && d.protein_g >= floor) proteinDaysHit += 1;
    }
    if (d.steps != null) stepsVals.push(d.steps);
    if (d.calories != null) kcalVals.push(d.calories);
  }

  const weightVals = inputs.weights
    .filter((w) => inWeek(w.logged_at, weekStartISO))
    .map((w) => Number(w.weight_kg));

  return {
    weekStartISO,
    sessions,
    sets,
    volumeKg: Math.round(volumeKg),
    runKm: Math.round((runMeters / 1000) * 10) / 10,
    runPaceSecPerKm: paceSecPerKm(paceMeters, paceSec),
    stationEfforts,
    proteinDaysHit,
    proteinDaysLogged,
    avgSteps: mean(stepsVals),
    avgKcal: mean(kcalVals),
    avgWeightKg: mean(weightVals),
  };
}

/**
 * Next-week running volume: +10% on the best recent week, capped at the top
 * of the target band, never below what was already run. Zero history → start
 * at the bottom of the band.
 */
export function nextRunKm(
  baseKm: number,
  low: number | null,
  high: number | null,
): number {
  if (baseKm <= 0) return low ?? 0;
  let target = baseKm * 1.1;
  if (high != null) target = Math.min(target, high);
  target = Math.max(target, baseKm);
  return Math.round(target * 10) / 10;
}

export type LiftBest = { weightKg: number; reps: number };

/**
 * Double-progression aim off a best set, when no forecast exists:
 * <8 reps (strength work) → add a plate step at the same reps;
 * 8–11 reps → add a rep; at 12 → add a plate step and drop back to 8.
 */
export function liftAim(best: LiftBest, plateStepKg = 2.5): LiftBest {
  if (best.reps >= 12) {
    return { weightKg: best.weightKg + plateStepKg, reps: 8 };
  }
  if (best.reps >= 8) {
    return { weightKg: best.weightKg, reps: best.reps + 1 };
  }
  return { weightKg: best.weightKg + plateStepKg, reps: best.reps };
}
