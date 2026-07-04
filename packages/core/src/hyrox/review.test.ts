import { describe, expect, it } from "vitest";
import {
  liftAim,
  nextRunKm,
  weekSlice,
  weekStartWithOffset,
  type ReviewInputs,
} from "./review";

const EMPTY: ReviewInputs = {
  sessions: [],
  sets: [],
  cardio: [],
  daily: [],
  weights: [],
};

describe("weekStartWithOffset", () => {
  it("returns the Monday of the containing week at offset 0", () => {
    expect(weekStartWithOffset("2026-07-03", 0)).toBe("2026-06-29"); // Fri → Mon
    expect(weekStartWithOffset("2026-06-29", 0)).toBe("2026-06-29"); // Mon → itself
    expect(weekStartWithOffset("2026-07-05", 0)).toBe("2026-06-29"); // Sun → prev Mon
  });

  it("shifts whole weeks, crossing month boundaries", () => {
    expect(weekStartWithOffset("2026-07-03", -1)).toBe("2026-06-22");
    expect(weekStartWithOffset("2026-07-03", 1)).toBe("2026-07-06");
    expect(weekStartWithOffset("2026-07-03", -5)).toBe("2026-05-25");
  });
});

describe("weekSlice", () => {
  const WEEK = "2026-06-29";

  it("returns zeros/nulls on empty inputs", () => {
    const s = weekSlice(EMPTY, WEEK);
    expect(s).toEqual({
      weekStartISO: WEEK,
      sessions: 0,
      sets: 0,
      volumeKg: 0,
      runKm: 0,
      runPaceSecPerKm: null,
      stationEfforts: 0,
      proteinDaysHit: 0,
      proteinDaysLogged: 0,
      avgSteps: null,
      avgKcal: null,
      avgWeightKg: null,
    });
  });

  it("counts only completed sessions inside the Monday–Sunday window", () => {
    const s = weekSlice(
      {
        ...EMPTY,
        sessions: [
          { started_at: "2026-06-29T06:00:00Z", ended_at: "2026-06-29T07:00:00Z" },
          { started_at: "2026-07-05T20:00:00", ended_at: "2026-07-05T21:00:00" }, // Sunday counts
          { started_at: "2026-07-01T06:00:00", ended_at: null }, // in progress → no
          { started_at: "2026-06-28T06:00:00", ended_at: "2026-06-28T07:00:00" }, // prev week
        ],
      },
      WEEK,
    );
    expect(s.sessions).toBe(2);
  });

  it("sums non-warmup sets and volume, coercing numeric strings", () => {
    const s = weekSlice(
      {
        ...EMPTY,
        sets: [
          { completed_at: "2026-06-30T10:00:00", reps: 5, weight_kg: "100", is_warmup: false },
          { completed_at: "2026-06-30T10:05:00", reps: 8, weight_kg: 60, is_warmup: false },
          { completed_at: "2026-06-30T09:55:00", reps: 10, weight_kg: 40, is_warmup: true },
        ],
      },
      WEEK,
    );
    expect(s.sets).toBe(2);
    expect(s.volumeKg).toBe(500 + 480);
  });

  it("splits cardio into run km/pace and station efforts", () => {
    const s = weekSlice(
      {
        ...EMPTY,
        cardio: [
          { kind: "run", distance_m: 5000, duration_sec: 1500, logged_at: "2026-06-30T07:00:00" },
          { kind: "run", distance_m: 3000, duration_sec: null, logged_at: "2026-07-02T07:00:00" },
          { kind: "ski", distance_m: 1000, duration_sec: 240, logged_at: "2026-07-01T07:00:00" },
          { kind: "sled_push", distance_m: 50, duration_sec: null, logged_at: "2026-07-01T07:10:00" },
        ],
      },
      WEEK,
    );
    expect(s.runKm).toBe(8);
    expect(s.runPaceSecPerKm).toBe(300); // paced over the 5k only
    expect(s.stationEfforts).toBe(2);
  });

  it("tracks protein hits against the floor plus step/kcal/weight averages", () => {
    const s = weekSlice(
      {
        ...EMPTY,
        proteinFloorG: 140,
        daily: [
          { logged_at: "2026-06-29", protein_g: 150, calories: 2300, steps: 8000 },
          { logged_at: "2026-06-30", protein_g: 120, calories: 2700, steps: 10000 },
          { logged_at: "2026-07-01", protein_g: null, calories: null, steps: 9000 },
          { logged_at: "2026-06-28", protein_g: 200, calories: 2000, steps: 100 }, // prev week
        ],
        weights: [
          { logged_at: "2026-06-29", weight_kg: "91.0" },
          { logged_at: "2026-07-02", weight_kg: 90.0 },
        ],
      },
      WEEK,
    );
    expect(s.proteinDaysLogged).toBe(2);
    expect(s.proteinDaysHit).toBe(1);
    expect(s.avgSteps).toBe(9000);
    expect(s.avgKcal).toBe(2500);
    expect(s.avgWeightKg).toBeCloseTo(90.5);
  });
});

describe("nextRunKm", () => {
  it("suggests +10% on the base week", () => {
    expect(nextRunKm(20, 30, 50)).toBe(22);
    expect(nextRunKm(18.9, 30, 50)).toBeCloseTo(20.8);
  });

  it("caps at the top of the band but never below what was already run", () => {
    expect(nextRunKm(48, 30, 50)).toBe(50);
    expect(nextRunKm(55, 30, 50)).toBe(55); // already past the cap → hold
  });

  it("starts at the bottom of the band with zero history", () => {
    expect(nextRunKm(0, 30, 50)).toBe(30);
    expect(nextRunKm(0, null, null)).toBe(0);
  });

  it("works without a band", () => {
    expect(nextRunKm(10, null, null)).toBe(11);
  });
});

describe("liftAim", () => {
  it("adds load at strength reps (<8)", () => {
    expect(liftAim({ weightKg: 100, reps: 5 })).toEqual({ weightKg: 102.5, reps: 5 });
  });

  it("adds a rep in the 8–11 range", () => {
    expect(liftAim({ weightKg: 60, reps: 8 })).toEqual({ weightKg: 60, reps: 9 });
    expect(liftAim({ weightKg: 60, reps: 11 })).toEqual({ weightKg: 60, reps: 12 });
  });

  it("adds load and resets to 8 at 12+ reps", () => {
    expect(liftAim({ weightKg: 60, reps: 12 })).toEqual({ weightKg: 62.5, reps: 8 });
  });

  it("respects a custom plate step", () => {
    expect(liftAim({ weightKg: 30, reps: 5 }, 2)).toEqual({ weightKg: 32, reps: 5 });
  });
});
