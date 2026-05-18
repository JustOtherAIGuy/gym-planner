export type Anchor = { weeks: number; value: number };

export type Curve = (weeksFromBaseline: number, anchors: Anchor[]) => number;

export type CurveKind = "linear" | "log" | "stepped";

/**
 * Anchors describe the progression contract: weeks=0 is the baseline,
 * additional anchors are target points (e.g. 12w, 24w).
 *
 * Outside the anchor range the curve clamps to the nearest endpoint.
 */
export const linearCurve: Curve = (weeksFromBaseline, anchors) => {
  if (anchors.length === 0) {
    throw new RangeError("linearCurve requires at least one anchor");
  }
  const sorted = [...anchors].sort((a, b) => a.weeks - b.weeks);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (weeksFromBaseline <= first.weeks) return first.value;
  if (weeksFromBaseline >= last.weeks) return last.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (weeksFromBaseline >= a.weeks && weeksFromBaseline <= b.weeks) {
      const span = b.weeks - a.weeks;
      if (span === 0) return b.value;
      const t = (weeksFromBaseline - a.weeks) / span;
      return a.value + t * (b.value - a.value);
    }
  }
  // Unreachable given the early-returns above.
  return last.value;
};

// v1 — gains decelerate; not yet wired but exported so callers can adopt.
export const logCurve: Curve = (weeksFromBaseline, anchors) => {
  if (anchors.length === 0) {
    throw new RangeError("logCurve requires at least one anchor");
  }
  const sorted = [...anchors].sort((a, b) => a.weeks - b.weeks);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (weeksFromBaseline <= first.weeks) return first.value;
  if (weeksFromBaseline >= last.weeks) return last.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (weeksFromBaseline >= a.weeks && weeksFromBaseline <= b.weeks) {
      const span = b.weeks - a.weeks;
      if (span === 0) return b.value;
      const t = (weeksFromBaseline - a.weeks) / span;
      // log easing: t' = ln(1 + 9t) / ln(10) maps [0,1] -> [0,1] with front-loaded gains
      const eased = Math.log(1 + 9 * t) / Math.log(10);
      return a.value + eased * (b.value - a.value);
    }
  }
  return last.value;
};

// Stepped: hold each anchor's value until the next anchor's week is reached.
export const steppedCurve: Curve = (weeksFromBaseline, anchors) => {
  if (anchors.length === 0) {
    throw new RangeError("steppedCurve requires at least one anchor");
  }
  const sorted = [...anchors].sort((a, b) => a.weeks - b.weeks);
  let current = sorted[0]!.value;
  for (const a of sorted) {
    if (weeksFromBaseline >= a.weeks) current = a.value;
    else break;
  }
  return current;
};

export const curveByKind: Record<CurveKind, Curve> = {
  linear: linearCurve,
  log: logCurve,
  stepped: steppedCurve,
};
