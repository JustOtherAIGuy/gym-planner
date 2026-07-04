import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeTargetWorkingWeight,
  linearCurve,
  weeksBetween,
  type CurveKind,
} from "@gym-planner/core/forecast";
import { weekStartWithOffset } from "@gym-planner/core/hyrox";
import { clearBuffer } from "./sessionBuffer";
import type {
  TBodyWeightLog,
  TCardioKind,
  TCardioLog,
  TChecklistItem,
  TDailyLog,
  TExercise,
  TForecastAnchor,
  TForecastTarget,
  TMetricAnchor,
  TMetricKey,
  TMetricTarget,
  TProgram,
  TProgramDay,
  TProgramExercise,
  TProgramPhase,
  TProgramWeek,
  TRace,
  TRaceSplit,
  TSetLog,
  TWorkoutSession,
} from "@gym-planner/core/schemas";

export type ProgramDayWithExercises = TProgramDay & {
  program_exercises: (TProgramExercise & { exercises: TExercise })[];
};

export async function fetchExercises(db: SupabaseClient): Promise<TExercise[]> {
  const { data, error } = await db.from("exercises").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as TExercise[];
}

export async function fetchPrograms(db: SupabaseClient): Promise<TProgram[]> {
  const { data, error } = await db
    .from("programs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TProgram[];
}

/**
 * Make one program THE active program. Home and Plan follow whichever program
 * is active, and `.find(status === "active")` silently picks the newest if two
 * are — so activation is exclusive: archive everything else FIRST, then flip
 * the target (a mid-failure leaves zero actives, never two).
 */
export async function activateProgram(
  db: SupabaseClient,
  programId: string,
): Promise<void> {
  const { error: e1 } = await db
    .from("programs")
    .update({ status: "archived" })
    .neq("id", programId);
  if (e1) throw e1;
  const { error: e2 } = await db
    .from("programs")
    .update({ status: "active" })
    .eq("id", programId);
  if (e2) throw e2;
}

export async function fetchProgramDays(
  db: SupabaseClient,
  programId: string,
): Promise<ProgramDayWithExercises[]> {
  const { data, error } = await db
    .from("program_days")
    .select("*, program_exercises(*, exercises(*))")
    .eq("program_id", programId)
    .order("day_index");
  if (error) throw error;
  const days = (data ?? []) as ProgramDayWithExercises[];
  for (const d of days) {
    d.program_exercises.sort((a, b) => a.order_index - b.order_index);
  }
  return days;
}

export async function fetchForecasts(
  db: SupabaseClient,
): Promise<TForecastTarget[]> {
  const { data, error } = await db.from("forecast_targets").select("*");
  if (error) throw error;
  return (data ?? []) as TForecastTarget[];
}

export async function fetchBodyWeights(
  db: SupabaseClient,
  limitDays = 400,
): Promise<TBodyWeightLog[]> {
  const { data, error } = await db
    .from("body_weight_logs")
    .select("*")
    .order("logged_at", { ascending: true })
    .limit(limitDays);
  if (error) throw error;
  return (data ?? []) as TBodyWeightLog[];
}

export async function fetchSetLogsForExercise(
  db: SupabaseClient,
  exerciseId: string,
): Promise<(TSetLog & { workout_sessions: { started_at: string } })[]> {
  const { data, error } = await db
    .from("set_logs")
    .select("*, workout_sessions(started_at)")
    .eq("exercise_id", exerciseId)
    .order("completed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as (TSetLog & {
    workout_sessions: { started_at: string };
  })[];
}

/** Most recent completed session for a program day, for "last time" prefills. */
export async function fetchLastSessionSets(
  db: SupabaseClient,
  programDayId: string,
): Promise<TSetLog[]> {
  const { data: sessions, error } = await db
    .from("workout_sessions")
    .select("id")
    .eq("source_type", "program_day")
    .eq("source_id", programDayId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = (sessions ?? [])[0] as { id: string } | undefined;
  if (!last) return [];
  const { data: sets, error: e2 } = await db
    .from("set_logs")
    .select("*")
    .eq("session_id", last.id)
    .order("order_index")
    .order("set_index");
  if (e2) throw e2;
  return (sets ?? []) as TSetLog[];
}

export async function fetchRecentSessions(
  db: SupabaseClient,
  limit = 10,
): Promise<TWorkoutSession[]> {
  const { data, error } = await db
    .from("workout_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TWorkoutSession[];
}

/** Today's prescribed working weight for an exercise, from its forecast. */
export function prescribeToday(
  forecast: Pick<
    TForecastTarget,
    "baseline_value" | "baseline_date" | "targets" | "curve"
  >,
  targetReps: number,
): { workingWeightKg: number; targetOneRepMaxKg: number } {
  const weeks = weeksBetween(
    forecast.baseline_date,
    new Date().toISOString().slice(0, 10),
  );
  return computeTargetWorkingWeight({
    baseline: { weeks: 0, value: forecast.baseline_value },
    targets: (forecast.targets as TForecastAnchor[]).map((t) => ({
      weeks: t.at_weeks,
      value: t.value,
    })),
    curve: forecast.curve as CurveKind,
    weeksFromBaseline: weeks,
    targetReps,
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Monday 00:00 local of the current week, as an ISO timestamp. */
export function startOfWeekISO(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── Sessions: in-progress management ────────────────────────────────────────

/** Newest session still in progress (ended_at IS NULL), or null. */
export async function fetchInProgressSession(
  db: SupabaseClient,
): Promise<TWorkoutSession | null> {
  const { data, error } = await db
    .from("workout_sessions")
    .select("*")
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as TWorkoutSession | undefined) ?? null;
}

/**
 * THE delete path for a session, used everywhere (Home banner, runner discard,
 * history). cardio_logs.session_id is ON DELETE SET NULL, so cardio rows must
 * be deleted explicitly BEFORE the session row; set_logs and
 * circuit_station_logs cascade with it. Also clears the local pending buffer.
 */
export async function discardSession(
  db: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error: e1 } = await db
    .from("cardio_logs")
    .delete()
    .eq("session_id", sessionId);
  if (e1) throw e1;
  const { error: e2 } = await db
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId);
  if (e2) throw e2;
  clearBuffer(sessionId);
}

/**
 * Guarded session start: if a session is already in progress, return it
 * instead of creating a duplicate. The only session creator for Home/Plan.
 */
export async function startProgramDaySession(
  db: SupabaseClient,
  dayId: string,
): Promise<
  | { kind: "started"; id: string }
  | { kind: "in_progress"; session: TWorkoutSession }
> {
  const open = await fetchInProgressSession(db);
  if (open) return { kind: "in_progress", session: open };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await db
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      source_type: "program_day",
      source_id: dayId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { kind: "started", id: data.id as string };
}

// ─── Program ordering ────────────────────────────────────────────────────────

/**
 * Swap two days' day_index. unique(program_id, day_index) forces a 3-step
 * dance: A → parking spot past the max, B → A's slot, A → B's slot.
 */
export async function swapDayIndices(
  db: SupabaseClient,
  programId: string,
  a: { id: string; day_index: number },
  b: { id: string; day_index: number },
): Promise<void> {
  const { data: maxRow, error: e0 } = await db
    .from("program_days")
    .select("day_index")
    .eq("program_id", programId)
    .order("day_index", { ascending: false })
    .limit(1)
    .single();
  if (e0) throw e0;
  const parking = (maxRow.day_index as number) + 1;
  const step = async (id: string, day_index: number) => {
    const { error } = await db
      .from("program_days")
      .update({ day_index })
      .eq("id", id);
    if (error) throw error;
  };
  await step(a.id, parking);
  await step(b.id, a.day_index);
  await step(a.id, b.day_index);
}

/** Swap two exercises' order_index (no unique constraint — plain 2 updates). */
export async function swapExerciseOrder(
  db: SupabaseClient,
  a: { id: string; order_index: number },
  b: { id: string; order_index: number },
): Promise<void> {
  const { error: e1 } = await db
    .from("program_exercises")
    .update({ order_index: b.order_index })
    .eq("id", a.id);
  if (e1) throw e1;
  const { error: e2 } = await db
    .from("program_exercises")
    .update({ order_index: a.order_index })
    .eq("id", b.id);
  if (e2) throw e2;
}

// ─── Workout history ─────────────────────────────────────────────────────────

export type SessionSummary = TWorkoutSession & {
  /** Resolved day/circuit name; null → source was deleted. */
  sourceName: string | null;
  setCount: number;
  cardioCount: number;
  stationCount: number;
};

export async function fetchSessionSummaries(
  db: SupabaseClient,
  limit = 20,
): Promise<SessionSummary[]> {
  const { data, error } = await db
    .from("workout_sessions")
    .select(
      "*, set_logs(count), cardio_logs(count), circuit_station_logs(count)",
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  type Row = TWorkoutSession & {
    set_logs: { count: number }[];
    cardio_logs: { count: number }[];
    circuit_station_logs: { count: number }[];
  };
  const rows = (data ?? []) as Row[];

  const dayIds = rows
    .filter((r) => r.source_type === "program_day" && r.source_id)
    .map((r) => r.source_id as string);
  const circuitIds = rows
    .filter((r) => r.source_type === "circuit" && r.source_id)
    .map((r) => r.source_id as string);

  const names = new Map<string, string>();
  if (dayIds.length > 0) {
    const { data: days } = await db
      .from("program_days")
      .select("id, name")
      .in("id", dayIds);
    for (const d of days ?? []) names.set(d.id as string, d.name as string);
  }
  if (circuitIds.length > 0) {
    const { data: circuits } = await db
      .from("circuit_workouts")
      .select("id, name")
      .in("id", circuitIds);
    for (const c of circuits ?? []) names.set(c.id as string, c.name as string);
  }

  return rows.map((r) => ({
    ...r,
    sourceName: r.source_id ? (names.get(r.source_id) ?? null) : null,
    setCount: r.set_logs[0]?.count ?? 0,
    cardioCount: r.cardio_logs[0]?.count ?? 0,
    stationCount: r.circuit_station_logs[0]?.count ?? 0,
  }));
}

export type SessionDetail = {
  session: TWorkoutSession;
  sourceName: string | null;
  sets: (TSetLog & {
    exercises: { name: string; slug: string; modality: string };
  })[];
  cardio: (TCardioLog & {
    exercises: { name: string; slug: string; modality: string } | null;
  })[];
  stations: {
    id: string;
    station_index: number;
    rotation_index: number;
    exercise_label: string;
    reps: number | null;
    weight_kg: number | null;
    duration_sec: number | null;
  }[];
};

export async function fetchSessionDetail(
  db: SupabaseClient,
  sessionId: string,
): Promise<SessionDetail> {
  const { data: session, error } = await db
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error) throw error;
  const s = session as TWorkoutSession;

  let sourceName: string | null = null;
  if (s.source_id) {
    const table =
      s.source_type === "circuit" ? "circuit_workouts" : "program_days";
    const { data: src } = await db
      .from(table)
      .select("name")
      .eq("id", s.source_id)
      .maybeSingle();
    sourceName = (src?.name as string | undefined) ?? null;
  }

  const [sets, cardio, stations] = await Promise.all([
    db
      .from("set_logs")
      .select("*, exercises(name, slug, modality)")
      .eq("session_id", sessionId)
      .order("order_index")
      .order("set_index"),
    db
      .from("cardio_logs")
      .select("*, exercises(name, slug, modality)")
      .eq("session_id", sessionId)
      .order("order_index")
      .order("set_index"),
    db
      .from("circuit_station_logs")
      .select("*")
      .eq("session_id", sessionId)
      .order("rotation_index")
      .order("station_index"),
  ]);
  if (sets.error) throw sets.error;
  if (cardio.error) throw cardio.error;
  if (stations.error) throw stations.error;

  return {
    session: s,
    sourceName,
    sets: (sets.data ?? []) as SessionDetail["sets"],
    cardio: (cardio.data ?? []) as SessionDetail["cardio"],
    stations: (stations.data ?? []) as SessionDetail["stations"],
  };
}

/** Non-warmup sets logged this week, grouped by primary muscle. */
export async function fetchWeeklyMuscleCounts(
  db: SupabaseClient,
): Promise<Partial<Record<string, number>>> {
  const { data, error } = await db
    .from("set_logs")
    .select("is_warmup, exercises(primary_muscle)")
    .gte("completed_at", startOfWeekISO());
  if (error) throw error;
  const counts: Partial<Record<string, number>> = {};
  for (const row of (data ?? []) as unknown as {
    is_warmup: boolean;
    exercises: { primary_muscle: string } | null;
  }[]) {
    if (row.is_warmup || !row.exercises) continue;
    const m = row.exercises.primary_muscle;
    counts[m] = (counts[m] ?? 0) + 1;
  }
  return counts;
}

// ─── Week review ─────────────────────────────────────────────────────────────

export type ReviewSetRow = TSetLog & {
  exercises: Pick<TExercise, "id" | "name" | "slug" | "modality"> | null;
};

export type ReviewData = {
  sessions: Pick<TWorkoutSession, "started_at" | "ended_at">[];
  sets: ReviewSetRow[];
  cardio: TCardioLog[];
  daily: TDailyLog[];
  weights: TBodyWeightLog[];
};

/**
 * Everything the week-review needs, in one parallel sweep. Fetches a day
 * wider than `weeks` Mondays back — weekSlice() re-buckets rows exactly,
 * so over-fetching across the UTC/local boundary is harmless.
 */
export async function fetchReviewData(
  db: SupabaseClient,
  weeks = 6,
): Promise<ReviewData> {
  const monday = weekStartWithOffset(todayISO(), -(weeks - 1));
  const d = new Date(`${monday}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const since = d.toISOString();
  const sinceDate = since.slice(0, 10);

  const [sessions, sets, cardio, daily, weights] = await Promise.all([
    db
      .from("workout_sessions")
      .select("started_at, ended_at")
      .gte("started_at", since),
    db
      .from("set_logs")
      .select("*, exercises(id, name, slug, modality)")
      .gte("completed_at", since),
    db.from("cardio_logs").select("*").gte("logged_at", since),
    db.from("daily_logs").select("*").gte("logged_at", sinceDate),
    db.from("body_weight_logs").select("*").gte("logged_at", sinceDate),
  ]);
  for (const r of [sessions, sets, cardio, daily, weights]) {
    if (r.error) throw r.error;
  }

  return {
    sessions: (sessions.data ?? []) as ReviewData["sessions"],
    sets: (sets.data ?? []) as ReviewData["sets"],
    cardio: (cardio.data ?? []) as TCardioLog[],
    daily: (daily.data ?? []) as TDailyLog[],
    weights: (weights.data ?? []) as TBodyWeightLog[],
  };
}

// ─── Races ───────────────────────────────────────────────────────────────────

/** Splits deleted explicitly (belt-and-braces), then the race row. */
export async function deleteRace(
  db: SupabaseClient,
  raceId: string,
): Promise<void> {
  const { error: e1 } = await db
    .from("race_splits")
    .delete()
    .eq("race_id", raceId);
  if (e1) throw e1;
  const { error: e2 } = await db.from("races").delete().eq("id", raceId);
  if (e2) throw e2;
}

// ─── HYROX: daily logs (nutrition + steps) ───────────────────────────────────

export async function fetchDailyLogs(
  db: SupabaseClient,
  limitDays = 90,
): Promise<TDailyLog[]> {
  const { data, error } = await db
    .from("daily_logs")
    .select("*")
    .order("logged_at", { ascending: false })
    .limit(limitDays);
  if (error) throw error;
  return (data ?? []) as TDailyLog[];
}

export async function upsertDailyLog(
  db: SupabaseClient,
  userId: string,
  log: {
    logged_at: string;
    calories?: number | null;
    protein_g?: number | null;
    fat_g?: number | null;
    steps?: number | null;
  },
): Promise<void> {
  const { error } = await db
    .from("daily_logs")
    .upsert({ user_id: userId, ...log }, { onConflict: "user_id,logged_at" });
  if (error) throw error;
}

// ─── HYROX: cardio / effort logs ─────────────────────────────────────────────

export async function fetchCardioLogs(
  db: SupabaseClient,
  opts: { kind?: TCardioKind; sinceISO?: string; limit?: number } = {},
): Promise<TCardioLog[]> {
  let q = db.from("cardio_logs").select("*");
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.sinceISO) q = q.gte("logged_at", opts.sinceISO);
  const { data, error } = await q
    .order("logged_at", { ascending: true })
    .limit(opts.limit ?? 2000);
  if (error) throw error;
  return (data ?? []) as TCardioLog[];
}

/** Most recent completed session's cardio rows for a program day (prefills). */
export async function fetchLastSessionCardio(
  db: SupabaseClient,
  programDayId: string,
): Promise<TCardioLog[]> {
  const { data: sessions, error } = await db
    .from("workout_sessions")
    .select("id")
    .eq("source_type", "program_day")
    .eq("source_id", programDayId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = (sessions ?? [])[0] as { id: string } | undefined;
  if (!last) return [];
  const { data: rows, error: e2 } = await db
    .from("cardio_logs")
    .select("*")
    .eq("session_id", last.id)
    .order("order_index")
    .order("set_index");
  if (e2) throw e2;
  return (rows ?? []) as TCardioLog[];
}

// ─── HYROX: metric targets ───────────────────────────────────────────────────

export async function fetchMetricTargets(
  db: SupabaseClient,
): Promise<Partial<Record<TMetricKey, TMetricTarget>>> {
  const { data, error } = await db.from("metric_targets").select("*");
  if (error) throw error;
  const byKey: Partial<Record<TMetricKey, TMetricTarget>> = {};
  for (const t of (data ?? []) as TMetricTarget[]) byKey[t.metric] = t;
  return byKey;
}

/**
 * Sample a trajectory target (baseline + anchors) into weekly chart points.
 * x = ms timestamps, matching the LineChart series convention.
 */
export function sampleMetricCurve(
  target: Pick<TMetricTarget, "baseline_value" | "baseline_date" | "targets">,
): { x: number; y: number }[] {
  if (
    target.baseline_value == null ||
    !target.baseline_date ||
    !target.targets?.length
  ) {
    return [];
  }
  const anchors = [
    { weeks: 0, value: target.baseline_value },
    ...(target.targets as TMetricAnchor[]).map((t) => ({
      weeks: t.at_weeks,
      value: t.value,
    })),
  ];
  const baseMs = Date.parse(`${target.baseline_date}T00:00:00`);
  const lastWeek = Math.max(...anchors.map((a) => a.weeks));
  const points: { x: number; y: number }[] = [];
  for (let w = 0; w <= lastWeek; w++) {
    points.push({
      x: baseMs + w * 7 * 24 * 60 * 60 * 1000,
      y: linearCurve(w, anchors),
    });
  }
  return points;
}

// ─── HYROX: program phases ───────────────────────────────────────────────────

export async function fetchPhases(
  db: SupabaseClient,
  programId: string,
): Promise<TProgramPhase[]> {
  const { data, error } = await db
    .from("program_phases")
    .select("*")
    .eq("program_id", programId)
    .order("phase_index");
  if (error) throw error;
  return (data ?? []) as TProgramPhase[];
}

// ─── HYROX: program weeks ────────────────────────────────────────────────────

export async function fetchProgramWeeks(
  db: SupabaseClient,
  programId: string,
): Promise<TProgramWeek[]> {
  const { data, error } = await db
    .from("program_weeks")
    .select("*")
    .eq("program_id", programId)
    .order("week_index");
  if (error) throw error;
  return (data ?? []) as TProgramWeek[];
}

export async function updateProgramWeek(
  db: SupabaseClient,
  id: string,
  patch: Partial<Pick<TProgramWeek, "run_km" | "long_run_km" | "note">>,
): Promise<void> {
  const { error } = await db
    .from("program_weeks")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Everything planWeekActuals needs, since the program start (minus a day —
 * over-fetch across the UTC/local boundary; the core helper re-buckets by
 * local date). Deliberately NOT fetchReviewData: that only reaches 6 Mondays
 * back and drags sets/daily/weights the ladder doesn't use.
 */
export async function fetchPlanActuals(
  db: SupabaseClient,
  sinceDateISO: string,
): Promise<{
  sessions: Pick<TWorkoutSession, "started_at" | "ended_at">[];
  cardio: TCardioLog[];
}> {
  const d = new Date(`${sinceDateISO}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const since = d.toISOString();
  const [sessions, cardio] = await Promise.all([
    db
      .from("workout_sessions")
      .select("started_at, ended_at")
      .gte("started_at", since),
    db.from("cardio_logs").select("*").gte("logged_at", since),
  ]);
  if (sessions.error) throw sessions.error;
  if (cardio.error) throw cardio.error;
  return {
    sessions: (sessions.data ?? []) as Pick<
      TWorkoutSession,
      "started_at" | "ended_at"
    >[],
    cardio: (cardio.data ?? []) as TCardioLog[],
  };
}

// ─── HYROX: races ────────────────────────────────────────────────────────────

export type RaceWithSplits = TRace & { race_splits: TRaceSplit[] };

export async function fetchRaces(
  db: SupabaseClient,
): Promise<RaceWithSplits[]> {
  const { data, error } = await db
    .from("races")
    .select("*, race_splits(*)")
    .order("event_date");
  if (error) throw error;
  const races = (data ?? []) as RaceWithSplits[];
  for (const r of races) r.race_splits.sort((a, b) => a.leg_index - b.leg_index);
  return races;
}

export async function upsertRaceSplits(
  db: SupabaseClient,
  raceId: string,
  splits: Omit<TRaceSplit, "id" | "race_id">[],
): Promise<void> {
  const { error } = await db.from("race_splits").upsert(
    splits.map((s) => ({ ...s, race_id: raceId })),
    { onConflict: "race_id,leg_index" },
  );
  if (error) throw error;
}

// ─── HYROX: checklist ────────────────────────────────────────────────────────

export async function fetchChecklist(
  db: SupabaseClient,
): Promise<TChecklistItem[]> {
  const { data, error } = await db
    .from("checklist_items")
    .select("*")
    .order("sort_index");
  if (error) throw error;
  return (data ?? []) as TChecklistItem[];
}

export async function toggleChecklistItem(
  db: SupabaseClient,
  id: string,
  done: boolean,
): Promise<void> {
  const { error } = await db
    .from("checklist_items")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}
