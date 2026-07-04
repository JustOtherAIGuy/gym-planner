import { describe, expect, it } from "vitest";
import { currentPhase, planTotalWeeks, planWeekNumber } from "./plan";

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
