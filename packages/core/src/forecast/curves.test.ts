import { describe, it, expect } from "vitest";
import {
  linearCurve,
  logCurve,
  steppedCurve,
  curveByKind,
} from "./curves";

const baseline = { weeks: 0, value: 80 };
const targets = [
  { weeks: 12, value: 100 },
  { weeks: 24, value: 115 },
];

describe("linearCurve", () => {
  it("clamps to the baseline before week 0", () => {
    expect(linearCurve(-1, [baseline, ...targets])).toBe(80);
  });

  it("returns the baseline at week 0", () => {
    expect(linearCurve(0, [baseline, ...targets])).toBe(80);
  });

  it("hits the midpoint between baseline and first target at week 6", () => {
    // halfway 80→100 = 90
    expect(linearCurve(6, [baseline, ...targets])).toBeCloseTo(90, 6);
  });

  it("hits the first target exactly at week 12", () => {
    expect(linearCurve(12, [baseline, ...targets])).toBe(100);
  });

  it("interpolates between two non-baseline targets at week 18", () => {
    // halfway 100→115 = 107.5
    expect(linearCurve(18, [baseline, ...targets])).toBeCloseTo(107.5, 6);
  });

  it("clamps to the last target beyond the final anchor", () => {
    expect(linearCurve(40, [baseline, ...targets])).toBe(115);
  });

  it("handles a single anchor (flat line)", () => {
    expect(linearCurve(50, [baseline])).toBe(80);
    expect(linearCurve(-10, [baseline])).toBe(80);
  });

  it("rejects an empty anchor list", () => {
    expect(() => linearCurve(0, [])).toThrow(RangeError);
  });
});

describe("steppedCurve", () => {
  it("holds the previous value until the next anchor is reached", () => {
    const anchors = [baseline, ...targets];
    expect(steppedCurve(0, anchors)).toBe(80);
    expect(steppedCurve(11, anchors)).toBe(80);
    expect(steppedCurve(12, anchors)).toBe(100);
    expect(steppedCurve(23, anchors)).toBe(100);
    expect(steppedCurve(24, anchors)).toBe(115);
    expect(steppedCurve(100, anchors)).toBe(115);
  });
});

describe("logCurve", () => {
  it("front-loads gains: at week 6 it is above the linear midpoint", () => {
    const anchors = [baseline, ...targets];
    const linear = linearCurve(6, anchors);
    const log = logCurve(6, anchors);
    expect(log).toBeGreaterThan(linear);
  });

  it("matches anchors exactly at anchor weeks", () => {
    const anchors = [baseline, ...targets];
    expect(logCurve(0, anchors)).toBe(80);
    expect(logCurve(12, anchors)).toBeCloseTo(100, 6);
    expect(logCurve(24, anchors)).toBeCloseTo(115, 6);
  });
});

describe("curveByKind", () => {
  it("dispatches by name", () => {
    expect(curveByKind.linear).toBe(linearCurve);
    expect(curveByKind.log).toBe(logCurve);
    expect(curveByKind.stepped).toBe(steppedCurve);
  });
});
