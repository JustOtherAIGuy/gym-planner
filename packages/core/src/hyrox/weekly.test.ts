import { describe, expect, it } from "vitest";
import { startOfWeekMonday, weeklyRunAgg } from "./weekly";

describe("startOfWeekMonday", () => {
  it("maps any weekday to that week's Monday", () => {
    expect(startOfWeekMonday("2026-07-01")).toBe("2026-06-29"); // Wednesday
    expect(startOfWeekMonday("2026-06-29")).toBe("2026-06-29"); // Monday
    expect(startOfWeekMonday("2026-07-05")).toBe("2026-06-29"); // Sunday
    expect(startOfWeekMonday("2026-07-06")).toBe("2026-07-06"); // next Monday
  });
  it("accepts full timestamps", () => {
    expect(startOfWeekMonday("2026-07-01T18:30:00-04:00")).toBe("2026-06-29");
  });
});

describe("weeklyRunAgg", () => {
  it("groups runs into Monday weeks with km, pace, and session counts", () => {
    const agg = weeklyRunAgg([
      { kind: "run", distance_m: 3000, duration_sec: 1080, logged_at: "2026-06-30" },
      { kind: "run", distance_m: 2000, duration_sec: 720, logged_at: "2026-07-02" },
      { kind: "run", distance_m: 5000, duration_sec: 1500, logged_at: "2026-07-07" },
      { kind: "ski", distance_m: 1000, duration_sec: 240, logged_at: "2026-07-02" },
    ]);
    expect(agg).toHaveLength(2);
    expect(agg[0]).toEqual({
      weekStartISO: "2026-06-29",
      km: 5,
      avgPaceSecPerKm: 360,
      sessions: 2,
    });
    expect(agg[1]!.km).toBe(5);
    expect(agg[1]!.avgPaceSecPerKm).toBe(300);
  });

  it("counts interval reps on one day as a single session", () => {
    const agg = weeklyRunAgg(
      Array.from({ length: 6 }, (_, i) => ({
        kind: "run",
        distance_m: 400,
        duration_sec: 120,
        logged_at: `2026-07-01T18:${String(10 + i)}:00Z`,
      })),
    );
    expect(agg).toHaveLength(1);
    expect(agg[0]!.sessions).toBe(1);
    expect(agg[0]!.km).toBe(2.4);
  });

  it("skips runs without distance and tolerates missing duration", () => {
    const agg = weeklyRunAgg([
      { kind: "run", distance_m: null, duration_sec: 1200, logged_at: "2026-07-01" },
      { kind: "run", distance_m: 4000, duration_sec: null, logged_at: "2026-07-01" },
    ]);
    expect(agg).toHaveLength(1);
    expect(agg[0]!.km).toBe(4);
    expect(agg[0]!.avgPaceSecPerKm).toBeNull();
  });
});
