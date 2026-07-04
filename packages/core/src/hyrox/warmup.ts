/**
 * Warm-ups — tailored prep that rides along with whatever the active program
 * prescribes. A day is classified from its exercises (+ name for run days),
 * mapped to a routine, and the first main lift gets a computed bar ramp.
 */

export type WarmupDayKind =
  | "push"
  | "pull"
  | "legs"
  | "full_body"
  | "run_easy"
  | "run_hard"
  | "stations";

export type WarmupExerciseInput = {
  slug: string;
  modality: string; // strength | cardio | station
  primary_muscle: string;
};

const PUSH_MUSCLES = new Set(["chest", "shoulders", "triceps"]);
const PULL_MUSCLES = new Set(["back", "lats", "biceps", "rear-delts"]);
const LEG_MUSCLES = new Set([
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "posterior",
  "lower-back",
]);

/**
 * What kind of day is this? Station-heavy → stations; all-cardio → easy or
 * hard running (from the day name); otherwise majority-muscle vote across the
 * strength work (strictly >60% or it's a full-body day).
 */
export function classifyWarmupDay(
  dayName: string,
  exercises: WarmupExerciseInput[],
): WarmupDayKind {
  if (exercises.length === 0) return "full_body";

  const nonStrength = exercises.filter((e) => e.modality !== "strength");
  if (nonStrength.length * 2 >= exercises.length && nonStrength.length > 0) {
    if (exercises.every((e) => e.modality === "cardio")) {
      return /interval|repeat|test|stride|pace|hard/i.test(dayName)
        ? "run_hard"
        : "run_easy";
    }
    return "stations";
  }

  let push = 0;
  let pull = 0;
  let legs = 0;
  let counted = 0;
  for (const e of exercises) {
    if (e.modality !== "strength") continue;
    if (PUSH_MUSCLES.has(e.primary_muscle)) push += 1;
    else if (PULL_MUSCLES.has(e.primary_muscle)) pull += 1;
    else if (LEG_MUSCLES.has(e.primary_muscle)) legs += 1;
    else continue; // core / full-body / grip don't vote
    counted += 1;
  }
  if (counted === 0) return "full_body";
  if (push / counted > 0.6) return "push";
  if (pull / counted > 0.6) return "pull";
  if (legs / counted > 0.6) return "legs";
  return "full_body";
}

export type WarmupStep = { label: string; detail: string };

export const WARMUP_LABEL: Record<WarmupDayKind, string> = {
  push: "Push day prep",
  pull: "Pull day prep",
  legs: "Leg day prep",
  full_body: "Full-body prep",
  run_easy: "Easy run prep",
  run_hard: "Hard run prep",
  stations: "Stations prep",
};

export const WARMUP_ROUTINES: Record<WarmupDayKind, WarmupStep[]> = {
  push: [
    { label: "Raise", detail: "2 min easy row, bike or brisk incline walk" },
    {
      label: "Shoulders",
      detail: "Arm circles ×10 each way · band dislocates ×8",
    },
    { label: "Upper back", detail: "Band pull-aparts ×15" },
    { label: "Prime", detail: "Scap push-ups ×10 · push-ups ×8" },
  ],
  pull: [
    { label: "Raise", detail: "2 min easy row or ski" },
    { label: "Hang", detail: "Dead hang 20–30 s · scap pulls ×8" },
    {
      label: "Upper back",
      detail: "Band pull-aparts ×15 · light face pulls ×12",
    },
    { label: "Prime", detail: "Light band or cable row ×12" },
  ],
  legs: [
    { label: "Raise", detail: "2 min easy bike or row" },
    { label: "Hips", detail: "Leg swings ×10/side, front and sideways" },
    { label: "Pattern", detail: "Slow bodyweight squats ×12, full depth" },
    { label: "Prime", detail: "Walking lunges ×6/side" },
  ],
  full_body: [
    { label: "Raise", detail: "2–3 min easy row or ski" },
    { label: "Mobility", detail: "World's greatest stretch ×3/side" },
    {
      label: "Prime",
      detail: "Bodyweight squats ×12 · band pull-aparts ×15",
    },
  ],
  run_easy: [
    {
      label: "Just start",
      detail: "First 3–5 min slower than easy — the run warms you up",
    },
    { label: "If stiff", detail: "Leg swings ×10/side · ankle bounces ×15" },
    { label: "Skip", detail: "No static stretching before running" },
  ],
  run_hard: [
    { label: "Jog", detail: "10 min easy, building the last 2" },
    { label: "Drills", detail: "Leg swings ×10/side · high knees 2×20 m" },
    {
      label: "Strides",
      detail: "4×20 s building to workout pace, walk back between",
    },
    { label: "Pace", detail: "Run rep 1 at the slow end of the range" },
  ],
  stations: [
    { label: "Raise", detail: "3 min easy erg, building the last 30 s" },
    {
      label: "Mobility",
      detail: "Inchworm walk-outs ×5 · world's greatest stretch ×2/side",
    },
    { label: "Prime", detail: "Bodyweight squats ×12 · jumping jacks ×20" },
    {
      label: "Rehearse",
      detail: "One light practice rep at each station before the clock",
    },
  ],
};

export type RampSet = { weightKg: number; reps: number };

const roundPlate = (kg: number, step = 2.5) => Math.round(kg / step) * step;

/**
 * Ramp-up sets for the day's first main lift: empty bar, then ~45/65/85% of
 * the working weight with falling reps. Steps at or below the bar (or at or
 * above the working weight) are dropped; light lifts get a short ramp.
 * Returns [] when the working weight is too light to need one.
 */
export function barRamp(workingWeightKg: number, barKg = 20): RampSet[] {
  if (workingWeightKg <= barKg + 5) return [];
  const ramp: RampSet[] = [{ weightKg: barKg, reps: 10 }];
  const steps: [number, number][] = [
    [0.45, 5],
    [0.65, 3],
    [0.85, 2],
  ];
  for (const [pct, reps] of steps) {
    const kg = roundPlate(workingWeightKg * pct);
    if (kg <= barKg || kg >= workingWeightKg) continue;
    if (ramp.some((r) => r.weightKg === kg)) continue;
    ramp.push({ weightKg: kg, reps });
  }
  return ramp;
}
