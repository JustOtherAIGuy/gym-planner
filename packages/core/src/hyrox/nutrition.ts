export type ProteinLogInput = {
  logged_at: string; // YYYY-MM-DD
  protein_g: number | null;
};

export type ProteinHitRate = {
  /** Days at or above the protein floor. */
  hit: number;
  /** Days with any protein logged in the window. */
  logged: number;
  /** hit / logged, 0 when nothing logged. */
  rate: number;
};

/**
 * Protein adherence over the most recent `windowDays` logged entries
 * (logged days, not calendar days — missing days don't count against you).
 * Protein targets are a floor in practice: 140–160 g means "reach 140";
 * exceeding the top of the band still counts as a hit.
 */
export function proteinHitRate(
  logs: ProteinLogInput[],
  low: number,
  windowDays = 28,
): ProteinHitRate {
  const withProtein = logs
    .filter((l) => l.protein_g != null)
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    .slice(0, windowDays);
  const hit = withProtein.filter((l) => (l.protein_g as number) >= low).length;
  const logged = withProtein.length;
  return { hit, logged, rate: logged === 0 ? 0 : hit / logged };
}
