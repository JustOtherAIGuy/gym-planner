import type { TCardioKind } from "../schemas";

export type HyroxLeg = {
  leg_index: number;
  kind: "run" | "station";
  label: string;
  /** cardio_logs.kind for station benchmarks; null for runs/bodyweight legs. */
  cardio_kind: TCardioKind | null;
};

/** The fixed HYROX race order: 8×(1 km run → station). 17th leg is nothing —
 * roxzone lives on the race row — so this is exactly 16 legs. */
export const HYROX_LEGS: HyroxLeg[] = [
  { leg_index: 0, kind: "run", label: "Run 1 (1 km)", cardio_kind: "run" },
  { leg_index: 1, kind: "station", label: "SkiErg 1000 m", cardio_kind: "ski" },
  { leg_index: 2, kind: "run", label: "Run 2 (1 km)", cardio_kind: "run" },
  { leg_index: 3, kind: "station", label: "Sled Push 50 m", cardio_kind: "sled_push" },
  { leg_index: 4, kind: "run", label: "Run 3 (1 km)", cardio_kind: "run" },
  { leg_index: 5, kind: "station", label: "Sled Pull 50 m", cardio_kind: "sled_pull" },
  { leg_index: 6, kind: "run", label: "Run 4 (1 km)", cardio_kind: "run" },
  { leg_index: 7, kind: "station", label: "Burpee Broad Jump 80 m", cardio_kind: "burpee_broad_jump" },
  { leg_index: 8, kind: "run", label: "Run 5 (1 km)", cardio_kind: "run" },
  { leg_index: 9, kind: "station", label: "Row 1000 m", cardio_kind: "row" },
  { leg_index: 10, kind: "run", label: "Run 6 (1 km)", cardio_kind: "run" },
  { leg_index: 11, kind: "station", label: "Farmers Carry 200 m", cardio_kind: "farmers_carry" },
  { leg_index: 12, kind: "run", label: "Run 7 (1 km)", cardio_kind: "run" },
  { leg_index: 13, kind: "station", label: "Sandbag Lunges 100 m", cardio_kind: "sandbag_lunge" },
  { leg_index: 14, kind: "run", label: "Run 8 (1 km)", cardio_kind: "run" },
  { leg_index: 15, kind: "station", label: "Wall Balls ×100", cardio_kind: null },
];

export type StationSpec = {
  station: string;
  /** Matching cardio_logs.kind (null = tracked via set_logs, e.g. wall balls). */
  cardio_kind: TCardioKind | null;
  distance: string;
  open: string;
  pro: string;
};

/** Men's Open vs Pro loads (loads include the sled's own weight). */
export const HYROX_STATION_SPECS: StationSpec[] = [
  { station: "SkiErg", cardio_kind: "ski", distance: "1000 m", open: "—", pro: "—" },
  { station: "Sled Push", cardio_kind: "sled_push", distance: "50 m", open: "152 kg", pro: "202 kg" },
  { station: "Sled Pull", cardio_kind: "sled_pull", distance: "50 m", open: "103 kg", pro: "153 kg" },
  { station: "Burpee Broad Jump", cardio_kind: "burpee_broad_jump", distance: "80 m", open: "bodyweight", pro: "bodyweight" },
  { station: "Row", cardio_kind: "row", distance: "1000 m", open: "—", pro: "—" },
  { station: "Farmers Carry", cardio_kind: "farmers_carry", distance: "200 m", open: "2×24 kg", pro: "2×32 kg" },
  { station: "Sandbag Lunges", cardio_kind: "sandbag_lunge", distance: "100 m", open: "20 kg", pro: "30 kg" },
  { station: "Wall Balls", cardio_kind: null, distance: "100 reps", open: "6 kg → 3 m", pro: "9 kg → 3 m" },
];

export type LadderTier = {
  label: string;
  /** Finish at or under this many seconds qualifies for the tier. */
  maxSec: number;
};

/** Men's finish-time ladder, fastest tier first. */
export const FINISH_LADDER: LadderTier[] = [
  { label: "Elite", maxSec: 60 * 60 },
  { label: "Pro-competitive", maxSec: 70 * 60 },
  { label: "Strong", maxSec: 75 * 60 },
  { label: "Competitive", maxSec: 80 * 60 },
  { label: "Average Open", maxSec: 90 * 60 },
  { label: "First-timer", maxSec: 115 * 60 },
];

/** The tier a finish time lands in (slower than every tier → last tier). */
export function ladderTier(finishSec: number): LadderTier {
  for (const tier of FINISH_LADDER) {
    if (finishSec <= tier.maxSec) return tier;
  }
  return FINISH_LADDER[FINISH_LADDER.length - 1]!;
}

/** Sum of split durations (for the splits-vs-finish sanity line). */
export function sumSplits(splits: Array<{ duration_sec: number }>): number {
  return splits.reduce((acc, s) => acc + s.duration_sec, 0);
}
