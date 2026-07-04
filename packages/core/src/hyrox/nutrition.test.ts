import { describe, expect, it } from "vitest";
import { proteinHitRate } from "./nutrition";

describe("proteinHitRate", () => {
  it("treats the low target as a floor", () => {
    const r = proteinHitRate(
      [
        { logged_at: "2026-07-01", protein_g: 150 },
        { logged_at: "2026-07-02", protein_g: 120 },
        { logged_at: "2026-07-03", protein_g: 180 }, // above band still a hit
        { logged_at: "2026-07-04", protein_g: null }, // unlogged, ignored
      ],
      140,
    );
    expect(r).toEqual({ hit: 2, logged: 3, rate: 2 / 3 });
  });

  it("only looks at the most recent windowDays logged entries", () => {
    const logs = Array.from({ length: 40 }, (_, i) => ({
      logged_at: `2026-06-${String(i + 1).padStart(2, "0")}`,
      protein_g: i < 20 ? 100 : 150, // older 20 miss, newer 20 hit
    }));
    const r = proteinHitRate(logs, 140, 20);
    expect(r).toEqual({ hit: 20, logged: 20, rate: 1 });
  });

  it("returns zero rate when nothing is logged", () => {
    expect(proteinHitRate([], 140)).toEqual({ hit: 0, logged: 0, rate: 0 });
  });
});
