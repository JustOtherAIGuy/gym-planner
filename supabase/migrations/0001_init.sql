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
  note       text
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
-- forecast_targets (per-exercise per-program; v0 supports metric='1rm' only)
-- =============================================================================
create table public.forecast_targets (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references public.programs(id) on delete cascade,
  exercise_id    uuid not null references public.exercises(id),
  metric         text not null default '1rm'
                 check (metric in ('1rm','top_set_weight','volume')),
  baseline_value numeric(7,2) not null check (baseline_value > 0 and baseline_value <= 500),
  baseline_date  date not null default current_date,
  targets        jsonb not null,
  curve          text not null default 'linear'
                 check (curve in ('linear','log','stepped')),
  unique (program_id, exercise_id, metric)
);

alter table public.forecast_targets enable row level security;
create policy "own forecasts" on public.forecast_targets
  for all using (
    exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid())
  );

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
