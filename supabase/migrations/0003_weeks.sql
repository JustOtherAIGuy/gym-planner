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
