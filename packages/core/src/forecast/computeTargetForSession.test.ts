import { describe, it, expect } from "vitest";
import {
  computeTargetWorkingWeight,
  weeksBetween,
} from "./computeTargetForSession";

const baseline = { weeks: 0, value: 80 };
const targets = [
  { weeks: 12, value: 100 },
  { weeks: 24, value: 115 },
];

describe("computeTargetWorkingWeight (linear)", () => {
  it("returns the baseline working weight at week 0 for 5 reps", () => {
    const out = computeTargetWorkingWeight({
      baseline,
      targets,
      curve: "linear",
      weeksFromBaseline: 0,
      targetReps: 5,
    });
    // e1RM target = 80, working = 80 / (1 + 5/30) = 68.57 → round to 67.5? Actually 68.57 → nearest 2.5 = 67.5.
    expect(out.targetOneRepMaxKg).toBe(80);
    expect(out.workingWeightKg).toBe(67.5);
  });

  it("hits the 100 kg 1RM target at week 12, working weight ~ 85 kg for 5 reps", () => {
    const out = computeTargetWorkingWeight({
      baseline,
      targets,
      curve: "linear",
      weeksFromBaseline: 12,
      targetReps: 5,
    });
    expect(out.targetOneRepMaxKg).toBeCloseTo(100, 6);
    // 100 / (1 + 5/30) = 85.71 → rounded to 85
    expect(out.workingWeightKg).toBe(85);
  });

  it("clamps to the final target after week 24", () => {
    const out = computeTargetWorkingWeight({
      baseline,
      targets,
      curve: "linear",
      weeksFromBaseline: 100,
      targetReps: 5,
    });
    expect(out.targetOneRepMaxKg).toBe(115);
    // 115 / 1.1667 = 98.57 → round to 97.5
    expect(out.workingWeightKg).toBe(97.5);
  });

  it("respects a custom plate step (5 kg)", () => {
    const out = computeTargetWorkingWeight({
      baseline,
      targets,
      curve: "linear",
      weeksFromBaseline: 12,
      targetReps: 5,
      plateStepKg: 5,
    });
    // 85.71 → nearest 5 = 85
    expect(out.workingWeightKg).toBe(85);
  });

  it("rejects rep counts below 1", () => {
    expect(() =>
      computeTargetWorkingWeight({
        baseline,
        targets,
        curve: "linear",
        weeksFromBaseline: 0,
        targetReps: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe("weeksBetween", () => {
  it("returns ~12 weeks for exact 84 days", () => {
    const a = "2026-01-01T00:00:00Z";
    const b = "2026-03-26T00:00:00Z"; // 84 days later
    expect(weeksBetween(a, b)).toBeCloseTo(12, 6);
  });

  it("returns a negative number when b is before a", () => {
    expect(weeksBetween("2026-03-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBeLessThan(0);
  });

  it("throws on invalid dates", () => {
    expect(() => weeksBetween("not-a-date", "2026-01-01T00:00:00Z")).toThrow(
      RangeError,
    );
  });
});
