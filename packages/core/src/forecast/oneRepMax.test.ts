import { describe, it, expect } from "vitest";
import { epleyOneRepMax, inverseEpley, roundToPlate } from "./oneRepMax";

describe("epleyOneRepMax", () => {
  it("equals the weight at 1 rep", () => {
    expect(epleyOneRepMax(100, 1)).toBeCloseTo(100 * (1 + 1 / 30), 6);
  });

  it("matches the formula for a typical 5-rep set", () => {
    // 100 kg × 5 → 100 * (1 + 5/30) = 116.667
    expect(epleyOneRepMax(100, 5)).toBeCloseTo(116.6667, 3);
  });

  it("rejects rep counts below 1", () => {
    expect(() => epleyOneRepMax(100, 0)).toThrow(RangeError);
  });

  it("rejects negative weights", () => {
    expect(() => epleyOneRepMax(-1, 5)).toThrow(RangeError);
  });
});

describe("inverseEpley", () => {
  it("inverts epleyOneRepMax for the same rep count", () => {
    const w = 100;
    const e1rm = epleyOneRepMax(w, 5);
    expect(inverseEpley(e1rm, 5)).toBeCloseTo(w, 6);
  });

  it("returns the 1RM itself at 1 rep", () => {
    // inverseEpley(e1rm, 1) = e1rm / (1 + 1/30)
    expect(inverseEpley(100, 1)).toBeCloseTo(100 / (1 + 1 / 30), 6);
  });
});

describe("roundToPlate", () => {
  it("rounds 81 to 80 (nearest) at 2.5 step", () => {
    expect(roundToPlate(81, 2.5)).toBe(80);
  });

  it("rounds 81.7 to 82.5 at 2.5 step", () => {
    expect(roundToPlate(81.7, 2.5)).toBe(82.5);
  });

  it("rounds 82.5 to 82.5 (boundary)", () => {
    expect(roundToPlate(82.5, 2.5)).toBe(82.5);
  });

  it("rounds 81.3 to 82.5 (closer to 82.5 than 80)", () => {
    expect(roundToPlate(81.3, 2.5)).toBe(82.5);
  });

  it("supports a 5 kg step", () => {
    expect(roundToPlate(83, 5)).toBe(85);
    expect(roundToPlate(82, 5)).toBe(80);
  });

  it("rejects non-positive steps", () => {
    expect(() => roundToPlate(80, 0)).toThrow(RangeError);
  });
});
