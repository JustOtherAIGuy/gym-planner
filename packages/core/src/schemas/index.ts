import { z } from "zod";

// Primitive helpers
export const Uuid = z.string().uuid();
export const IsoTimestamp = z.string().datetime({ offset: true });
export const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

// Enums (kept in lock-step with the SQL CHECK constraints / enums)
export const Units = z.enum(["kg", "lb"]);
export const ProgramStatus = z.enum(["active", "archived"]);
export const ForecastMetric = z.enum(["1rm", "top_set_weight", "volume"]);
export const ForecastCurve = z.enum(["linear", "log", "stepped"]);
export const SessionSource = z.enum([
  "program_day",
  "circuit",
  "freestyle",
]);
export const CircuitSource = z.enum(["ai", "manual"]);

// ─── profiles ────────────────────────────────────────────────────────────────
export const Profile = z.object({
  id: Uuid,
  display_name: z.string().min(1).max(64).nullable(),
  units: Units.default("kg"),
  created_at: IsoTimestamp,
});

// ─── body_weight_logs ────────────────────────────────────────────────────────
export const BodyWeightLog = z.object({
  id: Uuid,
  user_id: Uuid,
  logged_at: DateOnly,
  weight_kg: z.number().positive().max(500),
  note: z.string().max(280).nullable(),
});

export const InsertBodyWeightLog = BodyWeightLog.omit({
  id: true,
  user_id: true,
});

// ─── exercises ───────────────────────────────────────────────────────────────
export const Exercise = z.object({
  id: Uuid,
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(96),
  primary_muscle: z.string().min(1).max(32),
  equipment: z.string().min(1).max(32),
  is_compound: z.boolean(),
});

// ─── programs ────────────────────────────────────────────────────────────────
export const Program = z.object({
  id: Uuid,
  user_id: Uuid,
  name: z.string().min(1).max(96),
  description: z.string().max(1000).nullable(),
  status: ProgramStatus.default("active"),
  start_date: DateOnly,
  created_at: IsoTimestamp,
  updated_at: IsoTimestamp,
});

export const ProgramDay = z.object({
  id: Uuid,
  program_id: Uuid,
  day_index: z.number().int().nonnegative(),
  name: z.string().min(1).max(64),
  rest_day: z.boolean().default(false),
});

export const ProgramExercise = z.object({
  id: Uuid,
  program_day_id: Uuid,
  exercise_id: Uuid,
  order_index: z.number().int().nonnegative(),
  target_sets: z.number().int().min(1).max(20),
  target_reps_low: z.number().int().min(1).max(50),
  target_reps_high: z.number().int().min(1).max(50),
  target_rpe: z.number().min(1).max(10).nullable(),
  notes: z.string().max(280).nullable(),
});

// ─── forecast_targets ────────────────────────────────────────────────────────
export const ForecastAnchor = z.object({
  at_weeks: z.number().int().min(1).max(520), // up to ~10 years
  value: z.number().positive().max(500),
});

export const ForecastTarget = z.object({
  id: Uuid,
  program_id: Uuid,
  exercise_id: Uuid,
  metric: ForecastMetric,
  baseline_value: z.number().positive().max(500),
  baseline_date: DateOnly,
  targets: z.array(ForecastAnchor).min(1).max(8),
  curve: ForecastCurve.default("linear"),
});

// ─── workout_sessions + set_logs ─────────────────────────────────────────────
export const WorkoutSession = z.object({
  id: Uuid,
  user_id: Uuid,
  source_type: SessionSource,
  source_id: Uuid.nullable(),
  started_at: IsoTimestamp,
  ended_at: IsoTimestamp.nullable(),
  notes: z.string().max(1000).nullable(),
  bodyweight_kg: z.number().positive().max(500).nullable(),
});

export const SetLog = z.object({
  id: Uuid,
  session_id: Uuid,
  exercise_id: Uuid,
  order_index: z.number().int().nonnegative(),
  set_index: z.number().int().nonnegative(),
  reps: z.number().int().min(0).max(100),
  weight_kg: z.number().nonnegative().max(1000),
  rpe: z.number().min(1).max(10).nullable(),
  is_warmup: z.boolean().default(false),
  completed_at: IsoTimestamp,
});

// ─── circuit_workouts (v1) ───────────────────────────────────────────────────
// The `spec` is intentionally typed via a versioned schema. v1 is below.
// When Claude generates a v2 shape, bump schema_version and add migrateSpec().

export const CircuitStationSpecV1 = z.object({
  index: z.number().int().nonnegative(),
  label: z.string().min(1).max(64),
  // One of: timed (work_sec/rest_sec) OR rep-based (reps)
  work_sec: z.number().int().min(1).max(3600).nullable(),
  rest_sec: z.number().int().min(0).max(3600).nullable(),
  reps: z.number().int().min(1).max(200).nullable(),
  load_hint_kg: z.number().nonnegative().max(500).nullable(),
  partner_role: z.enum(["work", "rest", "assist"]).nullable(),
});

export const CircuitSpecV1 = z.object({
  version: z.literal(1),
  duration_min: z.number().int().min(1).max(180),
  rotations: z.number().int().min(1).max(20),
  partner_mode: z.boolean(),
  stations: z.array(CircuitStationSpecV1).min(1).max(12),
});

export const CircuitWorkout = z.object({
  id: Uuid,
  user_id: Uuid,
  name: z.string().min(1).max(96),
  description: z.string().max(1000).nullable(),
  source: CircuitSource,
  ai_prompt: z.string().max(4000).nullable(),
  ai_response_id: z.string().max(256).nullable(),
  duration_min: z.number().int().min(1).max(180),
  rotations: z.number().int().min(1).max(20),
  partner_mode: z.boolean(),
  schema_version: z.literal(1),
  spec: CircuitSpecV1,
});

// Inferred types (use these as the canonical TS types)
export type TProfile = z.infer<typeof Profile>;
export type TBodyWeightLog = z.infer<typeof BodyWeightLog>;
export type TExercise = z.infer<typeof Exercise>;
export type TProgram = z.infer<typeof Program>;
export type TProgramDay = z.infer<typeof ProgramDay>;
export type TProgramExercise = z.infer<typeof ProgramExercise>;
export type TForecastAnchor = z.infer<typeof ForecastAnchor>;
export type TForecastTarget = z.infer<typeof ForecastTarget>;
export type TWorkoutSession = z.infer<typeof WorkoutSession>;
export type TSetLog = z.infer<typeof SetLog>;
export type TCircuitWorkout = z.infer<typeof CircuitWorkout>;
export type TCircuitSpecV1 = z.infer<typeof CircuitSpecV1>;
