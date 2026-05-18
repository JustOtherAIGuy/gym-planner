import { inverseEpley, roundToPlate } from "./oneRepMax";
import { curveByKind, type Anchor, type CurveKind } from "./curves";

export type ComputeTargetInput = {
  /** Baseline 1RM anchor at week 0 (or whichever start week is chosen). */
  baseline: Anchor;
  /** Future target anchors. */
  targets: Anchor[];
  /** Which curve to fit. */
  curve: CurveKind;
  /** Whole or fractional weeks since the baseline_date. */
  weeksFromBaseline: number;
  /** The session's prescribed rep target (e.g. top set of 5). */
  targetReps: number;
  /** Plate increment in kg. Defaults to 2.5. */
  plateStepKg?: number;
};

export type ComputeTargetOutput = {
  /** Target estimated 1RM at this point in the forecast. */
  targetOneRepMaxKg: number;
  /** Rounded working weight that should yield `targetReps` reps. */
  workingWeightKg: number;
};

/**
 * v0 forecast — returns the working weight you should hit today
 * to stay on the forecast curve for this exercise.
 *
 * v0 supports only the "1rm" metric; baseline/target values are
 * interpreted as estimated 1RMs in kg.
 */
export function computeTargetWorkingWeight(
  input: ComputeTargetInput,
): ComputeTargetOutput {
  const {
    baseline,
    targets,
    curve,
    weeksFromBaseline,
    targetReps,
    plateStepKg = 2.5,
  } = input;

  if (targetReps < 1) {
    throw new RangeError("targetReps must be >= 1");
  }

  const anchors: Anchor[] = [baseline, ...targets];
  const curveFn = curveByKind[curve];
  const targetOneRepMaxKg = curveFn(weeksFromBaseline, anchors);
  const rawWorking = inverseEpley(targetOneRepMaxKg, targetReps);
  const workingWeightKg = roundToPlate(rawWorking, plateStepKg);

  return { targetOneRepMaxKg, workingWeightKg };
}

/**
 * Convenience: given a baseline_date and today, compute weeks elapsed
 * as a fractional number. Useful for the UI layer.
 */
export function weeksBetween(baselineISO: string, todayISO: string): number {
  const a = Date.parse(baselineISO);
  const b = Date.parse(todayISO);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new RangeError("Invalid ISO date passed to weeksBetween");
  }
  const ms = b - a;
  return ms / (1000 * 60 * 60 * 24 * 7);
}
