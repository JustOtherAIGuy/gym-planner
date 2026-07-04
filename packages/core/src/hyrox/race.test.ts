import { describe, expect, it } from "vitest";
import {
  FINISH_LADDER,
  HYROX_LEGS,
  HYROX_STATION_SPECS,
  ladderTier,
  sumSplits,
} from "./race";

describe("HYROX_LEGS", () => {
  it("is 16 legs alternating run/station, indexed in order", () => {
    expect(HYROX_LEGS).toHaveLength(16);
    HYROX_LEGS.forEach((leg, i) => {
      expect(leg.leg_index).toBe(i);
      expect(leg.kind).toBe(i % 2 === 0 ? "run" : "station");
    });
  });
});

describe("HYROX_STATION_SPECS", () => {
  it("lists the 8 stations in race order", () => {
    expect(HYROX_STATION_SPECS.map((s) => s.station)).toEqual([
      "SkiErg",
      "Sled Push",
      "Sled Pull",
      "Burpee Broad Jump",
      "Row",
      "Farmers Carry",
      "Sandbag Lunges",
      "Wall Balls",
    ]);
  });
});

describe("ladderTier", () => {
  it("maps finish times to tiers", () => {
    expect(ladderTier(59 * 60).label).toBe("Elite");
    expect(ladderTier(68 * 60).label).toBe("Pro-competitive");
    expect(ladderTier(74 * 60).label).toBe("Strong");
    expect(ladderTier(79 * 60).label).toBe("Competitive");
    expect(ladderTier(85 * 60).label).toBe("Average Open");
    expect(ladderTier(100 * 60).label).toBe("First-timer");
    expect(ladderTier(130 * 60).label).toBe("First-timer"); // slower than every tier
  });
  it("ladder is ordered fastest first", () => {
    const secs = FINISH_LADDER.map((t) => t.maxSec);
    expect([...secs].sort((a, b) => a - b)).toEqual(secs);
  });
});

describe("sumSplits", () => {
  it("adds durations", () => {
    expect(sumSplits([{ duration_sec: 300 }, { duration_sec: 420 }])).toBe(720);
    expect(sumSplits([])).toBe(0);
  });
});
