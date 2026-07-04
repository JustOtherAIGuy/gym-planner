import { describe, expect, it } from "vitest";
import { formatHMS, formatMS, formatPace, paceSecPerKm } from "./pace";

describe("paceSecPerKm", () => {
  it("computes sec/km", () => {
    expect(paceSecPerKm(5000, 1500)).toBe(300); // 25:00 5k = 5:00/km
    expect(paceSecPerKm(400, 120)).toBe(300);
  });
  it("returns null on missing or zero inputs", () => {
    expect(paceSecPerKm(null, 1500)).toBeNull();
    expect(paceSecPerKm(5000, null)).toBeNull();
    expect(paceSecPerKm(0, 100)).toBeNull();
    expect(paceSecPerKm(100, 0)).toBeNull();
  });
});

describe("formatPace", () => {
  it("formats m:ss", () => {
    expect(formatPace(300)).toBe("5:00");
    expect(formatPace(324)).toBe("5:24");
    expect(formatPace(299.6)).toBe("5:00");
  });
  it("dashes on null/invalid", () => {
    expect(formatPace(null)).toBe("–");
    expect(formatPace(0)).toBe("–");
  });
});

describe("formatMS", () => {
  it("formats minutes:seconds", () => {
    expect(formatMS(1335)).toBe("22:15");
    expect(formatMS(59)).toBe("0:59");
  });
});

describe("formatHMS", () => {
  it("formats hours when over an hour", () => {
    expect(formatHMS(5263)).toBe("1:27:43");
    expect(formatHMS(3600)).toBe("1:00:00");
  });
  it("falls back to m:ss under an hour", () => {
    expect(formatHMS(1335)).toBe("22:15");
  });
  it("dashes on null", () => {
    expect(formatHMS(null)).toBe("–");
  });
});
