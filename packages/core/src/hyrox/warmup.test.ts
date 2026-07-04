import { describe, expect, it } from "vitest";
import { barRamp, classifyWarmupDay } from "./warmup";

const ex = (slug: string, modality: string, primary_muscle: string) => ({
  slug,
  modality,
  primary_muscle,
});

describe("classifyWarmupDay", () => {
  it("classifies PPL push/pull/legs days by muscle majority", () => {
    expect(
      classifyWarmupDay("Push A", [
        ex("bench-press", "strength", "chest"),
        ex("overhead-press", "strength", "shoulders"),
        ex("incline-dumbbell-press", "strength", "chest"),
        ex("lateral-raise", "strength", "shoulders"),
        ex("tricep-pushdown", "strength", "triceps"),
      ]),
    ).toBe("push");

    // Pull B: deadlift votes legs, everything else pulls → still >60% pull.
    expect(
      classifyWarmupDay("Pull B", [
        ex("deadlift", "strength", "posterior"),
        ex("pull-up", "strength", "lats"),
        ex("dumbbell-row", "strength", "back"),
        ex("neutral-pulldown", "strength", "lats"),
        ex("rear-delt-fly", "strength", "rear-delts"),
        ex("dumbbell-curl", "strength", "biceps"),
      ]),
    ).toBe("pull");

    expect(
      classifyWarmupDay("Legs A", [
        ex("back-squat", "strength", "quads"),
        ex("romanian-deadlift", "strength", "hamstrings"),
        ex("leg-press", "strength", "quads"),
        ex("leg-curl", "strength", "hamstrings"),
        ex("calf-raise", "strength", "calves"),
        ex("plank", "strength", "core"), // core doesn't vote
      ]),
    ).toBe("legs");
  });

  it("calls mixed strength days full-body (core/full-body don't vote)", () => {
    expect(
      classifyWarmupDay("Full-Body A", [
        ex("back-squat", "strength", "quads"),
        ex("dumbbell-bench-press", "strength", "chest"),
        ex("seated-cable-row", "strength", "back"),
        ex("romanian-deadlift", "strength", "hamstrings"),
        ex("farmer-carry", "station", "grip"),
        ex("plank", "strength", "core"),
      ]),
    ).toBe("full_body");
  });

  it("splits run days into easy vs hard from the day name", () => {
    const run = [ex("run", "cardio", "full-body")];
    expect(classifyWarmupDay("Easy Run", run)).toBe("run_easy");
    expect(classifyWarmupDay("Long Easy Run", run)).toBe("run_easy");
    expect(classifyWarmupDay("Intervals", run)).toBe("run_hard");
    expect(classifyWarmupDay("1 km Repeats", run)).toBe("run_hard");
  });

  it("flags station-heavy days", () => {
    expect(
      classifyWarmupDay("HYROX Circuit", [
        ex("run", "cardio", "full-body"),
        ex("skierg", "cardio", "full-body"),
        ex("sled-push", "station", "quads"),
        ex("wall-ball", "strength", "full-body"),
        ex("sandbag-lunge", "station", "quads"),
      ]),
    ).toBe("stations");
  });

  it("defaults to full-body on empty or unvoting days", () => {
    expect(classifyWarmupDay("Anything", [])).toBe("full_body");
    expect(
      classifyWarmupDay("Core", [ex("plank", "strength", "core")]),
    ).toBe("full_body");
  });
});

describe("barRamp", () => {
  it("builds bar → 45/65/85% with falling reps", () => {
    expect(barRamp(100)).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 45, reps: 5 },
      { weightKg: 65, reps: 3 },
      { weightKg: 85, reps: 2 },
    ]);
  });

  it("drops steps at/below the bar and dedupes rounded collisions", () => {
    // 45% of 55 = 25, 65% = 35, 85% = 47.5
    expect(barRamp(55)).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 25, reps: 5 },
      { weightKg: 35, reps: 3 },
      { weightKg: 47.5, reps: 2 },
    ]);
    // 32.5 kg: 45% → 15 (≤ bar, dropped), 65% → 20 (≤ bar), 85% → 27.5
    expect(barRamp(32.5)).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 27.5, reps: 2 },
    ]);
  });

  it("returns no ramp for near-bar weights", () => {
    expect(barRamp(20)).toEqual([]);
    expect(barRamp(25)).toEqual([]);
  });
});
