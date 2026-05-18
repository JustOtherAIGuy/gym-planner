// Epley formula. Overestimates above ~10 reps; acceptable for v0.
// e1RM = weight * (1 + reps/30)
export function epleyOneRepMax(weightKg: number, reps: number): number {
  if (weightKg < 0) throw new RangeError("weightKg must be non-negative");
  if (reps < 1) throw new RangeError("reps must be >= 1");
  return weightKg * (1 + reps / 30);
}

// Given an estimated 1RM, find the working weight that should yield `reps` reps.
export function inverseEpley(oneRepMaxKg: number, reps: number): number {
  if (oneRepMaxKg < 0) throw new RangeError("oneRepMaxKg must be non-negative");
  if (reps < 1) throw new RangeError("reps must be >= 1");
  return oneRepMaxKg / (1 + reps / 30);
}

// Round to nearest 2.5 kg (matches a standard gym plate increment).
export function roundToPlate(weightKg: number, step = 2.5): number {
  if (step <= 0) throw new RangeError("step must be > 0");
  return Math.round(weightKg / step) * step;
}
