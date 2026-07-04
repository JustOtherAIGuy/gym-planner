import { describe, expect, it } from "vitest";
import {
  currentPhase,
  planTotalWeeks,
  planWeekActuals,
  planWeekNumber,
  planWeekWindow,
} from "./plan";

const phases = [
  { id: "1", phase_index: 0, name: "Foundation", focus: null, start_date: "2026-07-02", end_date: "2026-07-22" },
  { id: "2", phase_index: 1, name: "Build Engine", focus: null, start_date: "2026-07-23", end_date: "2026-08-19" },
  { id: "3", phase_index: 2, name: "HYROX-Specific", focus: null, start_date: "2026-08-20", end_date: "2026-09-16" },
  { id: "4", phase_index: 3, name: "Peak & Taper", focus: null, start_date: "2026-09-17", end_date: "2026-10-01" },
];

describe("currentPhase", () => {
  it("finds the phase containing today (boundaries inclusive)", () => {
    expect(currentPhase(phases, "2026-07-02")!.name).toBe("Foundation");
    expect(currentPhase(phases, "2026-07-22")!.name).toBe("Foundation");
    expect(currentPhase(phases, "2026-07-23")!.name).toBe("Build Engine");
    expect(currentPhase(phases, "2026-09-20")!.name).toBe("Peak & Taper");
  });
  it("clamps to first/last outside the plan window", () => {
    expect(currentPhase(phases, "2026-06-01")!.name).toBe("Foundation");
    expect(currentPhase(phases, "2026-11-01")!.name).toBe("Peak & Taper");
  });
  it("returns null for an empty list", () => {
    expect(currentPhase([], "2026-07-02")).toBeNull();
  });
});

describe("planWeekNumber", () => {
  it("is 1-based and rolls over every 7 days", () => {
    expect(planWeekNumber("2026-07-02", "2026-07-02")).toBe(1);
    expect(planWeekNumber("2026-07-02", "2026-07-08")).toBe(1);
    expect(planWeekNumber("2026-07-02", "2026-07-09")).toBe(2);
    expect(planWeekNumber("2026-07-02", "2026-09-30")).toBe(13);
    // Race day is one day past 13×7 — callers clamp to planTotalWeeks.
    expect(planWeekNumber("2026-07-02", "2026-10-01")).toBe(14);
  });
  it("clamps to week 1 before the start", () => {
    expect(planWeekNumber("2026-07-02", "2026-06-20")).toBe(1);
  });
});

describe("planTotalWeeks", () => {
  it("covers the 13-week HYROX window", () => {
    expect(planTotalWeeks("2026-07-02", "2026-10-01")).toBe(13);
  });
});

describe("planWeekWindow", () => {
  it("anchors half-open windows to the program start day", () => {
    expect(planWeekWindow("2026-07-02", 1)).toEqual({
      startISO: "2026-07-02",
      endISO: "2026-07-09",
    });
    expect(planWeekWindow("2026-07-02", 2).startISO).toBe("2026-07-09");
    // Week 13 ends the day before race day — Oct 1 is outside the plan weeks.
    expect(planWeekWindow("2026-07-02", 13)).toEqual({
      startISO: "2026-09-24",
      endISO: "2026-10-01",
    });
  });

  it("crosses month boundaries and rejects weekIndex < 1", () => {
    expect(planWeekWindow("2026-07-02", 5).startISO).toBe("2026-07-30");
    expect(() => planWeekWindow("2026-07-02", 0)).toThrow(RangeError);
  });
});

describe("planWeekActuals", () => {
  const START = "2026-07-02"; // Thursday

  it("returns zeros on empty inputs", () => {
    expect(planWeekActuals({ sessions: [], cardio: [] }, START, 1)).toEqual({
      weekIndex: 1,
      runKm: 0,
      longestRunKm: 0,
      sessions: 0,
      stationEfforts: 0,
    });
  });

  it("buckets by Thursday-anchored plan weeks, not Monday weeks", () => {
    const cardio = [
      // Wed Jul 8 → plan week 1; Thu Jul 9 → plan week 2 (same Monday-week!)
      { kind: "run", distance_m: 3000, duration_sec: null, logged_at: "2026-07-08T18:00:00" },
      { kind: "run", distance_m: 5000, duration_sec: null, logged_at: "2026-07-09T06:00:00" },
    ];
    const w1 = planWeekActuals({ sessions: [], cardio }, START, 1);
    const w2 = planWeekActuals({ sessions: [], cardio }, START, 2);
    expect(w1.runKm).toBe(3);
    expect(w2.runKm).toBe(5);
  });

  it("sums run km, tracks the longest single run, counts stations & completed sessions", () => {
    const out = planWeekActuals(
      {
        sessions: [
          { started_at: "2026-07-02T06:00:00", ended_at: "2026-07-02T07:00:00" },
          { started_at: "2026-07-03T06:00:00", ended_at: null }, // in progress
          { started_at: "2026-07-10T06:00:00", ended_at: "2026-07-10T07:00:00" }, // wk 2
        ],
        cardio: [
          { kind: "run", distance_m: 2500, duration_sec: 900, logged_at: "2026-07-03T07:00:00" },
          { kind: "run", distance_m: 4200, duration_sec: null, logged_at: "2026-07-05T07:00:00" },
          { kind: "ski", distance_m: 1000, duration_sec: 240, logged_at: "2026-07-04T07:00:00" },
          { kind: "sled_push", distance_m: 15, duration_sec: null, logged_at: "2026-07-04T07:10:00" },
        ],
      },
      START,
      1,
    );
    expect(out.runKm).toBe(6.7);
    expect(out.longestRunKm).toBe(4.2);
    expect(out.sessions).toBe(1);
    expect(out.stationEfforts).toBe(2);
  });
});
