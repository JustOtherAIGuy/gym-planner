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
