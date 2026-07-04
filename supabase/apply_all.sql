-- Gym Planner v0 schema
-- Single-user app today; RLS still scoped by auth.uid() = user_id everywhere so
-- a future multi-user move costs nothing.

set check_function_bodies = off;

-- =============================================================================
-- profiles
-- =============================================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  units        text not null default 'kg' check (units in ('kg','lb')),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- body_weight_logs
-- =============================================================================
create table public.body_weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  logged_at  date not null,
  weight_kg  numeric(6,2) not null check (weight_kg > 0 and weight_kg <= 500),
  note       text,
  -- One entry per day: logging twice the same day edits, never duplicates.
  unique (user_id, logged_at)
);

create index body_weight_logs_user_date_idx
  on public.body_weight_logs (user_id, logged_at desc);

alter table public.body_weight_logs enable row level security;
create policy "own body weight" on public.body_weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- exercises (global library — no user_id; RLS read-only public, no writes)
-- =============================================================================
create table public.exercises (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name           text not null,
  primary_muscle text not null,
  equipment      text not null,
  is_compound    boolean not null default false
);

alter table public.exercises enable row level security;
create policy "read exercises" on public.exercises
  for select using (true);
-- No insert/update/delete policies → only service-role can mutate.

-- =============================================================================
-- programs
-- =============================================================================
create table public.programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'active' check (status in ('active','archived')),
  start_date  date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index programs_user_idx on public.programs (user_id, created_at desc);

alter table public.programs enable row level security;
create policy "own programs" on public.programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.program_days (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  day_index  integer not null check (day_index >= 0),
  name       text not null,
  rest_day   boolean not null default false,
  unique (program_id, day_index)
);

create index program_days_program_idx on public.program_days (program_id, day_index);

alter table public.program_days enable row level security;
create policy "own program_days" on public.program_days
  for all using (
    exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid())
  );

create table public.program_exercises (
  id               uuid primary key default gen_random_uuid(),
  program_day_id   uuid not null references public.program_days(id) on delete cascade,
  exercise_id      uuid not null references public.exercises(id),
  order_index      integer not null check (order_index >= 0),
  target_sets      integer not null check (target_sets between 1 and 20),
  target_reps_low  integer not null check (target_reps_low between 1 and 50),
  target_reps_high integer not null check (target_reps_high between 1 and 50),
  target_rpe       numeric(3,1) check (target_rpe is null or (target_rpe between 1 and 10)),
  notes            text,
  check (target_reps_high >= target_reps_low)
);

create index program_exercises_day_idx on public.program_exercises (program_day_id, order_index);

alter table public.program_exercises enable row level security;
create policy "own program_exercises" on public.program_exercises
  for all using (
    exists (
      select 1
      from public.program_days d
      join public.programs p on p.id = d.program_id
      where d.id = program_day_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.program_days d
      join public.programs p on p.id = d.program_id
      where d.id = program_day_id and p.user_id = auth.uid()
    )
  );

-- =============================================================================
-- forecast_targets (per-user per-exercise; v0 supports metric='1rm' only)
-- Keyed to the user, not a program, so the forecast line survives program
-- switches and archives without fragmenting chart history.
-- =============================================================================
create table public.forecast_targets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  exercise_id    uuid not null references public.exercises(id),
  metric         text not null default '1rm'
                 check (metric in ('1rm','top_set_weight','volume')),
  baseline_value numeric(7,2) not null check (baseline_value > 0 and baseline_value <= 500),
  baseline_date  date not null default current_date,
  targets        jsonb not null,
  curve          text not null default 'linear'
                 check (curve in ('linear','log','stepped')),
  unique (user_id, exercise_id, metric)
);

alter table public.forecast_targets enable row level security;
create policy "own forecasts" on public.forecast_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- workout_sessions + set_logs
-- =============================================================================
create table public.workout_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  source_type    text not null check (source_type in ('program_day','circuit','freestyle')),
  source_id      uuid,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  notes          text,
  bodyweight_kg  numeric(6,2) check (bodyweight_kg is null or (bodyweight_kg > 0 and bodyweight_kg <= 500))
);

create index workout_sessions_user_started_idx
  on public.workout_sessions (user_id, started_at desc);

alter table public.workout_sessions enable row level security;
create policy "own sessions" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.set_logs (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id),
  order_index  integer not null check (order_index >= 0),
  set_index    integer not null check (set_index >= 0),
  reps         integer not null check (reps >= 0 and reps <= 100),
  weight_kg    numeric(7,2) not null check (weight_kg >= 0 and weight_kg <= 1000),
  rpe          numeric(3,1) check (rpe is null or (rpe between 1 and 10)),
  is_warmup    boolean not null default false,
  completed_at timestamptz not null default now()
);

-- Drives "show me my bench progression"
create index set_logs_user_exercise_time_idx
  on public.set_logs (exercise_id, completed_at desc);
create index set_logs_session_idx
  on public.set_logs (session_id, order_index, set_index);

alter table public.set_logs enable row level security;
create policy "own set_logs" on public.set_logs
  for all using (
    exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- =============================================================================
-- circuit_workouts (v1) — JSONB spec versioned for AI flexibility
-- =============================================================================
create table public.circuit_workouts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text,
  source          text not null check (source in ('ai','manual')),
  ai_prompt       text,
  ai_response_id  text,
  duration_min    integer not null check (duration_min between 1 and 180),
  rotations       integer not null check (rotations between 1 and 20),
  partner_mode    boolean not null default false,
  schema_version  integer not null default 1,
  spec            jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.circuit_workouts enable row level security;
create policy "own circuits" on public.circuit_workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.circuit_station_logs (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.workout_sessions(id) on delete cascade,
  station_index   integer not null check (station_index >= 0),
  rotation_index  integer not null check (rotation_index >= 0),
  exercise_label  text not null,
  reps            integer check (reps is null or (reps >= 0 and reps <= 200)),
  weight_kg       numeric(7,2) check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 1000)),
  duration_sec    integer check (duration_sec is null or (duration_sec >= 0 and duration_sec <= 3600)),
  partner_role    text check (partner_role is null or partner_role in ('work','rest','assist'))
);

alter table public.circuit_station_logs enable row level security;
create policy "own circuit_station_logs" on public.circuit_station_logs
  for all using (
    exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- =============================================================================
-- updated_at touch triggers
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger programs_touch_updated_at
  before update on public.programs
  for each row execute function public.touch_updated_at();

create trigger circuit_workouts_touch_updated_at
  before update on public.circuit_workouts
  for each row execute function public.touch_updated_at();
-- Common exercises. Seeded once. Add more via a new migration if needed.
-- Keep slugs stable — the app may reference them.

insert into public.exercises (slug, name, primary_muscle, equipment, is_compound) values
  -- Squat pattern
  ('back-squat',              'Back Squat',                'quads',     'barbell',    true),
  ('front-squat',             'Front Squat',               'quads',     'barbell',    true),
  ('goblet-squat',            'Goblet Squat',              'quads',     'kettlebell', true),
  ('bulgarian-split-squat',   'Bulgarian Split Squat',     'quads',     'dumbbell',   true),
  ('walking-lunge',           'Walking Lunge',             'quads',     'dumbbell',   true),
  ('leg-press',               'Leg Press',                 'quads',     'machine',    true),
  ('hack-squat',              'Hack Squat',                'quads',     'machine',    true),
  ('leg-extension',           'Leg Extension',             'quads',     'machine',    false),
  ('leg-curl',                'Leg Curl',                  'hamstrings','machine',    false),
  ('calf-raise',              'Standing Calf Raise',       'calves',    'machine',    false),

  -- Hinge pattern
  ('deadlift',                'Conventional Deadlift',     'posterior', 'barbell',    true),
  ('sumo-deadlift',           'Sumo Deadlift',             'posterior', 'barbell',    true),
  ('romanian-deadlift',       'Romanian Deadlift',         'hamstrings','barbell',    true),
  ('trap-bar-deadlift',       'Trap Bar Deadlift',         'posterior', 'barbell',    true),
  ('hip-thrust',              'Barbell Hip Thrust',        'glutes',    'barbell',    true),
  ('kettlebell-swing',        'Kettlebell Swing',          'posterior', 'kettlebell', true),
  ('good-morning',            'Good Morning',              'hamstrings','barbell',    true),
  ('back-extension',          'Back Extension',            'lower-back','bodyweight', false),

  -- Horizontal press
  ('bench-press',             'Barbell Bench Press',       'chest',     'barbell',    true),
  ('incline-bench-press',     'Incline Barbell Bench',     'chest',     'barbell',    true),
  ('dumbbell-bench-press',    'Dumbbell Bench Press',      'chest',     'dumbbell',   true),
  ('incline-dumbbell-press',  'Incline Dumbbell Press',    'chest',     'dumbbell',   true),
  ('push-up',                 'Push-Up',                   'chest',     'bodyweight', true),
  ('dip',                     'Parallel Bar Dip',          'chest',     'bodyweight', true),
  ('cable-fly',               'Cable Fly',                 'chest',     'cable',      false),

  -- Vertical press
  ('overhead-press',          'Overhead Press',            'shoulders', 'barbell',    true),
  ('seated-dumbbell-press',   'Seated Dumbbell Press',     'shoulders', 'dumbbell',   true),
  ('arnold-press',            'Arnold Press',              'shoulders', 'dumbbell',   true),
  ('push-press',              'Push Press',                'shoulders', 'barbell',    true),
  ('lateral-raise',           'Lateral Raise',             'shoulders', 'dumbbell',   false),
  ('rear-delt-fly',           'Rear Delt Fly',             'rear-delts','dumbbell',   false),

  -- Vertical pull
  ('pull-up',                 'Pull-Up',                   'lats',      'bodyweight', true),
  ('chin-up',                 'Chin-Up',                   'lats',      'bodyweight', true),
  ('lat-pulldown',            'Lat Pulldown',              'lats',      'cable',      true),
  ('neutral-pulldown',        'Neutral Grip Pulldown',     'lats',      'cable',      true),

  -- Horizontal pull
  ('barbell-row',             'Barbell Row',               'back',      'barbell',    true),
  ('pendlay-row',             'Pendlay Row',               'back',      'barbell',    true),
  ('dumbbell-row',            'One-Arm Dumbbell Row',      'back',      'dumbbell',   true),
  ('seated-cable-row',        'Seated Cable Row',          'back',      'cable',      true),
  ('t-bar-row',               'T-Bar Row',                 'back',      'barbell',    true),
  ('face-pull',               'Face Pull',                 'rear-delts','cable',      false),
  ('inverted-row',            'Inverted Row',              'back',      'bodyweight', true),

  -- Arms
  ('barbell-curl',            'Barbell Curl',              'biceps',    'barbell',    false),
  ('dumbbell-curl',           'Dumbbell Curl',             'biceps',    'dumbbell',   false),
  ('hammer-curl',             'Hammer Curl',               'biceps',    'dumbbell',   false),
  ('tricep-pushdown',         'Tricep Pushdown',           'triceps',   'cable',      false),
  ('skullcrusher',            'Skullcrusher',              'triceps',   'barbell',    false),
  ('overhead-tricep-ext',     'Overhead Tricep Extension', 'triceps',   'dumbbell',   false),

  -- Core
  ('plank',                   'Plank',                     'core',      'bodyweight', false),
  ('ab-wheel-rollout',        'Ab Wheel Rollout',          'core',      'bodyweight', true),
  ('hanging-leg-raise',       'Hanging Leg Raise',         'core',      'bodyweight', true),
  ('cable-crunch',            'Cable Crunch',              'core',      'cable',      false),
  ('pallof-press',            'Pallof Press',              'core',      'cable',      false),

  -- Carries / conditioning (useful for FitFactory-style circuits)
  ('farmer-carry',            'Farmer Carry',              'grip',      'dumbbell',   true),
  ('suitcase-carry',          'Suitcase Carry',            'core',      'dumbbell',   true),
  ('kettlebell-clean',        'Kettlebell Clean',          'full-body', 'kettlebell', true),
  ('kettlebell-snatch',       'Kettlebell Snatch',         'full-body', 'kettlebell', true),
  ('wall-ball',               'Wall Ball',                 'full-body', 'plate',      true),
  ('burpee',                  'Burpee',                    'full-body', 'bodyweight', true),
  ('rowing-erg',              'Rowing Erg',                'full-body', 'rower',      true)
on conflict (slug) do nothing;

-- =============================================================================
-- ===== 0002_hyrox.sql ========================================================
-- =============================================================================

-- 0002: HYROX journey support
-- Additive only: cardio/effort logging, daily nutrition+steps quick-logs,
-- generalized metric targets (trajectories + bands), program phases,
-- races with per-leg splits, and the Pro-ready checklist.

set check_function_bodies = off;

-- =============================================================================
-- exercises.modality — lets the session runner branch its logging UI
-- =============================================================================
alter table public.exercises
  add column modality text not null default 'strength'
  check (modality in ('strength','cardio','station'));

-- =============================================================================
-- daily_logs — one row per day: nutrition totals + steps
-- =============================================================================
create table public.daily_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  logged_at  date not null default current_date,
  calories   integer check (calories is null or (calories between 0 and 10000)),
  protein_g  integer check (protein_g is null or (protein_g between 0 and 500)),
  fat_g      integer check (fat_g is null or (fat_g between 0 and 500)),
  steps      integer check (steps is null or (steps between 0 and 100000)),
  -- One entry per day: logging twice the same day edits, never duplicates.
  unique (user_id, logged_at)
);

create index daily_logs_user_date_idx
  on public.daily_logs (user_id, logged_at desc);

alter table public.daily_logs enable row level security;
create policy "own daily_logs" on public.daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- cardio_logs — general effort log: runs, erg work, and HYROX station efforts.
-- session_id nullable so a standalone 5k test doesn't need a workout session.
-- A benchmark/time-trial is just style='test'.
-- =============================================================================
create table public.cardio_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  session_id   uuid references public.workout_sessions(id) on delete set null,
  exercise_id  uuid references public.exercises(id),
  kind         text not null check (kind in
                 ('run','row','ski','bike','sled_push','sled_pull',
                  'burpee_broad_jump','farmers_carry','sandbag_lunge')),
  style        text check (style is null or style in
                 ('easy','intervals','long','race_pace','run_walk','test')),
  distance_m   integer check (distance_m is null or (distance_m between 0 and 100000)),
  duration_sec integer check (duration_sec is null or (duration_sec between 0 and 36000)),
  load_kg      numeric(6,2) check (load_kg is null or (load_kg between 0 and 500)),
  reps         integer check (reps is null or (reps between 0 and 500)),
  order_index  integer check (order_index is null or order_index >= 0),
  set_index    integer check (set_index is null or set_index >= 0),
  logged_at    timestamptz not null default now(),
  note         text
);

create index cardio_logs_user_kind_time_idx
  on public.cardio_logs (user_id, kind, logged_at);
create index cardio_logs_session_idx
  on public.cardio_logs (session_id);

alter table public.cardio_logs enable row level security;
create policy "own cardio_logs" on public.cardio_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- metric_targets — non-lift goals. Two shapes in one row:
--   trajectories: baseline + anchor jsonb [{at_weeks,value}] (e.g. bodyweight)
--   bands:        target_low/target_high (e.g. protein 140–160 g)
-- =============================================================================
create table public.metric_targets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  metric         text not null check (metric in
                   ('bodyweight','run_5k_sec','weekly_run_km','protein_g',
                    'fat_g','calories_rest','calories_training','steps')),
  baseline_value numeric(8,2) check (baseline_value is null or baseline_value >= 0),
  baseline_date  date,
  targets        jsonb,
  target_low     numeric(8,2) check (target_low is null or target_low >= 0),
  target_high    numeric(8,2) check (target_high is null or target_high >= 0),
  direction      text not null default 'desc' check (direction in ('asc','desc')),
  unique (user_id, metric)
);

alter table public.metric_targets enable row level security;
create policy "own metric_targets" on public.metric_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- program_phases — dated mesocycles inside a program (e.g. 13-week HYROX plan)
-- =============================================================================
create table public.program_phases (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  phase_index integer not null check (phase_index >= 0),
  name        text not null,
  focus       text,
  start_date  date not null,
  end_date    date not null,
  unique (program_id, phase_index),
  check (end_date >= start_date)
);

create index program_phases_program_idx
  on public.program_phases (program_id, phase_index);

alter table public.program_phases enable row level security;
create policy "own program_phases" on public.program_phases
  for all using (
    exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid())
  );

alter table public.program_days
  add column phase_id uuid references public.program_phases(id) on delete set null;

-- =============================================================================
-- races + race_splits — HYROX events; 17 legs (8 runs + 8 stations + roxzone
-- kept on the race row itself)
-- =============================================================================
create table public.races (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  location    text,
  division    text not null default 'open'
              check (division in ('open','pro','doubles','relay')),
  event_date  date not null,
  status      text not null default 'registered'
              check (status in ('waitlist','registered','backup','completed')),
  finish_sec  integer check (finish_sec is null or (finish_sec between 0 and 28800)),
  roxzone_sec integer check (roxzone_sec is null or (roxzone_sec between 0 and 7200)),
  note        text
);

create index races_user_date_idx on public.races (user_id, event_date);

alter table public.races enable row level security;
create policy "own races" on public.races
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.race_splits (
  id           uuid primary key default gen_random_uuid(),
  race_id      uuid not null references public.races(id) on delete cascade,
  leg_index    integer not null check (leg_index between 0 and 16),
  kind         text not null check (kind in ('run','station')),
  label        text not null,
  duration_sec integer not null check (duration_sec between 0 and 7200),
  load_kg      numeric(6,2) check (load_kg is null or (load_kg between 0 and 500)),
  unique (race_id, leg_index)
);

alter table public.race_splits enable row level security;
create policy "own race_splits" on public.race_splits
  for all using (
    exists (select 1 from public.races r where r.id = race_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.races r where r.id = race_id and r.user_id = auth.uid())
  );

-- =============================================================================
-- checklist_items — long-horizon milestones (Pro-ready list)
-- =============================================================================
create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  slug        text not null,
  label       text not null,
  detail      text,
  target_text text,
  sort_index  integer not null default 0,
  done        boolean not null default false,
  done_at     timestamptz,
  unique (user_id, slug)
);

alter table public.checklist_items enable row level security;
create policy "own checklist_items" on public.checklist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════ 0003_weeks ═══════════════════════════════

-- 0003: program_weeks — fixed per-week targets for the Plan tab week ladder.
-- Additive only. Targets are hand-set (editable in-app), never auto-adapted;
-- actuals are computed client-side from cardio_logs/workout_sessions.

set check_function_bodies = off;

-- =============================================================================
-- program_weeks — one row per plan week: what to hit and why it changes
-- =============================================================================
create table public.program_weeks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  program_id     uuid not null references public.programs(id) on delete cascade,
  week_index     integer not null check (week_index >= 1),
  run_km         numeric(5,1) check (run_km is null or (run_km between 0 and 200)),
  long_run_km    numeric(5,1) check (long_run_km is null or (long_run_km between 0 and 100)),
  run_focus      text,
  strength_focus text,
  station_focus  text,
  flags          text[] not null default '{}'
                 check (flags <@ array['5k_test','cutback','half_sim','dress_rehearsal','race_week']::text[]),
  note           text,
  unique (program_id, week_index)
);

create index program_weeks_program_idx
  on public.program_weeks (program_id, week_index);

alter table public.program_weeks enable row level security;
create policy "own program_weeks" on public.program_weeks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
