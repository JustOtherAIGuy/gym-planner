import { paceSecPerKm } from "./pace";

export type WeeklyRunInput = {
  kind: string;
  distance_m: number | null;
  duration_sec: number | null;
  logged_at: string; // ISO timestamp or date
};

export type WeeklyRunAgg = {
  weekStartISO: string; // Monday, YYYY-MM-DD
  km: number;
  avgPaceSecPerKm: number | null;
  sessions: number;
};

/** Monday of the week containing dateISO, as YYYY-MM-DD (UTC-safe on date-only input). */
export function startOfWeekMonday(dateISO: string): string {
  const d = new Date(dateISO.length === 10 ? `${dateISO}T00:00:00` : dateISO);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError("Invalid ISO date passed to startOfWeekMonday");
  }
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Aggregate run efforts (kind === "run") into Monday-keyed weeks,
 * sorted ascending. Pace averages only over entries with both fields.
 */
export function weeklyRunAgg(logs: WeeklyRunInput[]): WeeklyRunAgg[] {
  const weeks = new Map<
    string,
    { meters: number; paceSecTotal: number; paceMeters: number; sessions: Set<string> }
  >();
  for (const log of logs) {
    if (log.kind !== "run" || !log.distance_m) continue;
    const key = startOfWeekMonday(log.logged_at);
    let w = weeks.get(key);
    if (!w) {
      w = { meters: 0, paceSecTotal: 0, paceMeters: 0, sessions: new Set() };
      weeks.set(key, w);
    }
    w.meters += log.distance_m;
    if (log.duration_sec) {
      w.paceSecTotal += log.duration_sec;
      w.paceMeters += log.distance_m;
    }
    // Distinct training days count as sessions (intervals log many rows).
    w.sessions.add(log.logged_at.slice(0, 10));
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStartISO, w]) => ({
      weekStartISO,
      km: Math.round((w.meters / 1000) * 100) / 100,
      avgPaceSecPerKm: paceSecPerKm(w.paceMeters, w.paceSecTotal),
      sessions: w.sessions.size,
    }));
}
