/** Pace in seconds per km, or null when either input is unusable. */
export function paceSecPerKm(
  distanceM: number | null | undefined,
  durationSec: number | null | undefined,
): number | null {
  if (!distanceM || !durationSec || distanceM <= 0 || durationSec <= 0) {
    return null;
  }
  return durationSec / (distanceM / 1000);
}

/** "5:24" — minutes:seconds per km. */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return "–";
  }
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "22:15" — minutes:seconds. */
export function formatMS(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "–";
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "1:27:43" — hours:minutes:seconds (falls back to m:ss under an hour). */
export function formatHMS(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "–";
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  if (h === 0) return formatMS(total);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
