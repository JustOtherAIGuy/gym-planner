-- Three pre-built PPL programs, seeded ON THE SHELF (status = 'archived') so
-- the active HYROX plan is untouched — activate from the Programs page.
-- Barbell-first, built around the user's forecast lifts (bench, squat, RDL,
-- OHP, row). Idempotent: each program block is skipped if the name exists.
-- Runs for BOTH accounts. Apply in the dashboard SQL editor (service role).

do $$
declare
  acct text;
  uid  uuid;
  pid  uuid;
begin
  foreach acct in array array['vishrutshah121@gmail.com', 'tester@gymplanner.dev'] loop
    select id into uid from auth.users where email = acct;
    if uid is null then
      raise notice 'skipping %: user not found', acct;
      continue;
    end if;

    -- ── 1. PPL · 6-Day (A/B) ────────────────────────────────────────────────
    if not exists (select 1 from public.programs where user_id = uid and name = 'PPL · 6-Day (A/B)') then
      insert into public.programs (user_id, name, description, status, start_date)
      values (uid, 'PPL · 6-Day (A/B)',
              'Classic high-volume split: Push A · Pull A · Legs A · Push B · Pull B · Legs B. Run it 3–6 days/week — Home always queues the next day in the rotation. Double progression: top of every rep range on all sets → +2.5 kg.',
              'archived', current_date)
      returning id into pid;

      insert into public.program_days (program_id, day_index, name, rest_day) values
        (pid, 0, 'Push A', false),
        (pid, 1, 'Pull A', false),
        (pid, 2, 'Legs A', false),
        (pid, 3, 'Push B', false),
        (pid, 4, 'Pull B', false),
        (pid, 5, 'Legs B', false);

      insert into public.program_exercises
        (program_day_id, exercise_id, order_index, target_sets, target_reps_low, target_reps_high, notes)
      select d.id, e.id, v.ord, v.sets, v.lo, v.hi, v.notes
      from (values
        -- Push A
        (0, 'bench-press',            0, 4,  5,  8, 'Main lift — matches your bench forecast'::text),
        (0, 'overhead-press',         1, 3,  8, 10, null::text),
        (0, 'incline-dumbbell-press', 2, 3, 10, 12, null),
        (0, 'lateral-raise',          3, 3, 12, 15, null),
        (0, 'tricep-pushdown',        4, 3, 10, 12, null),
        (0, 'cable-fly',              5, 3, 12, 15, null),
        -- Pull A
        (1, 'barbell-row',            0, 4,  5,  8, 'Main lift — matches your row forecast'),
        (1, 'lat-pulldown',           1, 3, 10, 12, null),
        (1, 'seated-cable-row',       2, 3, 10, 12, null),
        (1, 'face-pull',              3, 3, 12, 15, null),
        (1, 'barbell-curl',           4, 3,  8, 12, null),
        (1, 'hammer-curl',            5, 3, 10, 12, null),
        -- Legs A
        (2, 'back-squat',             0, 4,  5,  8, 'Main lift — matches your squat forecast'),
        (2, 'romanian-deadlift',      1, 3,  8, 10, null),
        (2, 'leg-press',              2, 3, 10, 12, null),
        (2, 'leg-curl',               3, 3, 10, 12, null),
        (2, 'calf-raise',             4, 4, 10, 15, null),
        (2, 'plank',                  5, 3,  1,  1, 'Hold 45–60 s'),
        -- Push B
        (3, 'overhead-press',         0, 4,  5,  8, 'Main lift — matches your OHP forecast'),
        (3, 'incline-bench-press',    1, 3,  8, 10, null),
        (3, 'dip',                    2, 3,  8, 12, 'Add weight when 12 gets easy'),
        (3, 'seated-dumbbell-press',  3, 3, 10, 12, null),
        (3, 'lateral-raise',          4, 3, 12, 15, null),
        (3, 'skullcrusher',           5, 3, 10, 12, null),
        -- Pull B
        (4, 'deadlift',               0, 3,  3,  5, 'Heavy — long rests, stop at technical failure'),
        (4, 'pull-up',                1, 4,  6, 10, 'Assisted is fine'),
        (4, 'dumbbell-row',           2, 3,  8, 10, null),
        (4, 'neutral-pulldown',       3, 3, 10, 12, null),
        (4, 'rear-delt-fly',          4, 3, 12, 15, null),
        (4, 'dumbbell-curl',          5, 3, 10, 12, null),
        -- Legs B
        (5, 'front-squat',            0, 4,  6,  8, null),
        (5, 'hip-thrust',             1, 3,  8, 10, null),
        (5, 'bulgarian-split-squat',  2, 3, 10, 12, 'Per leg'),
        (5, 'leg-extension',          3, 3, 12, 15, null),
        (5, 'calf-raise',             4, 4, 10, 15, null),
        (5, 'hanging-leg-raise',      5, 3, 10, 12, null)
      ) as v(day_idx, slug, ord, sets, lo, hi, notes)
      join public.program_days d on d.program_id = pid and d.day_index = v.day_idx
      join public.exercises e on e.slug = v.slug;

      raise notice 'PPL 6-day seeded for %', acct;
    end if;

    -- ── 2. PPL · 3-Day ──────────────────────────────────────────────────────
    if not exists (select 1 from public.programs where user_id = uid and name = 'PPL · 3-Day') then
      insert into public.programs (user_id, name, description, status, start_date)
      values (uid, 'PPL · 3-Day',
              'Condensed Push/Pull/Legs cycling continuously — the best-of version of the 6-day split. Double progression: top of every rep range on all sets → +2.5 kg.',
              'archived', current_date)
      returning id into pid;

      insert into public.program_days (program_id, day_index, name, rest_day) values
        (pid, 0, 'Push', false),
        (pid, 1, 'Pull', false),
        (pid, 2, 'Legs', false);

      insert into public.program_exercises
        (program_day_id, exercise_id, order_index, target_sets, target_reps_low, target_reps_high, notes)
      select d.id, e.id, v.ord, v.sets, v.lo, v.hi, v.notes
      from (values
        (0, 'bench-press',            0, 4,  5,  8, 'Main lift — matches your bench forecast'::text),
        (0, 'overhead-press',         1, 3,  8, 10, null::text),
        (0, 'incline-dumbbell-press', 2, 3, 10, 12, null),
        (0, 'lateral-raise',          3, 3, 12, 15, null),
        (0, 'tricep-pushdown',        4, 3, 10, 12, null),
        (1, 'barbell-row',            0, 4,  5,  8, 'Main lift — matches your row forecast'),
        (1, 'pull-up',                1, 3,  6, 10, 'Assisted is fine'),
        (1, 'lat-pulldown',           2, 3, 10, 12, null),
        (1, 'face-pull',              3, 3, 12, 15, null),
        (1, 'barbell-curl',           4, 3,  8, 12, null),
        (2, 'back-squat',             0, 4,  5,  8, 'Main lift — matches your squat forecast'),
        (2, 'romanian-deadlift',      1, 3,  8, 10, null),
        (2, 'leg-press',              2, 3, 10, 12, null),
        (2, 'leg-curl',               3, 3, 10, 12, null),
        (2, 'calf-raise',             4, 4, 10, 15, null),
        (2, 'plank',                  5, 3,  1,  1, 'Hold 45–60 s')
      ) as v(day_idx, slug, ord, sets, lo, hi, notes)
      join public.program_days d on d.program_id = pid and d.day_index = v.day_idx
      join public.exercises e on e.slug = v.slug;

      raise notice 'PPL 3-day seeded for %', acct;
    end if;

    -- ── 3. PPL · Push/Pull/Legs/Rest ────────────────────────────────────────
    if not exists (select 1 from public.programs where user_id = uid and name = 'PPL · Push/Pull/Legs/Rest') then
      insert into public.programs (user_id, name, description, status, start_date)
      values (uid, 'PPL · Push/Pull/Legs/Rest',
              'Push · Pull · Legs · Rest on repeat — a fixed recovery cadence built into the rotation. Double progression: top of every rep range on all sets → +2.5 kg.',
              'archived', current_date)
      returning id into pid;

      insert into public.program_days (program_id, day_index, name, rest_day) values
        (pid, 0, 'Push', false),
        (pid, 1, 'Pull', false),
        (pid, 2, 'Legs', false),
        (pid, 3, 'Rest — 8–10k steps', true);

      insert into public.program_exercises
        (program_day_id, exercise_id, order_index, target_sets, target_reps_low, target_reps_high, notes)
      select d.id, e.id, v.ord, v.sets, v.lo, v.hi, v.notes
      from (values
        (0, 'bench-press',            0, 4,  5,  8, 'Main lift — matches your bench forecast'::text),
        (0, 'overhead-press',         1, 3,  8, 10, null::text),
        (0, 'incline-dumbbell-press', 2, 3, 10, 12, null),
        (0, 'lateral-raise',          3, 3, 12, 15, null),
        (0, 'tricep-pushdown',        4, 3, 10, 12, null),
        (1, 'barbell-row',            0, 4,  5,  8, 'Main lift — matches your row forecast'),
        (1, 'pull-up',                1, 3,  6, 10, 'Assisted is fine'),
        (1, 'lat-pulldown',           2, 3, 10, 12, null),
        (1, 'face-pull',              3, 3, 12, 15, null),
        (1, 'barbell-curl',           4, 3,  8, 12, null),
        (2, 'back-squat',             0, 4,  5,  8, 'Main lift — matches your squat forecast'),
        (2, 'romanian-deadlift',      1, 3,  8, 10, null),
        (2, 'leg-press',              2, 3, 10, 12, null),
        (2, 'leg-curl',               3, 3, 10, 12, null),
        (2, 'calf-raise',             4, 4, 10, 15, null),
        (2, 'plank',                  5, 3,  1,  1, 'Hold 45–60 s')
      ) as v(day_idx, slug, ord, sets, lo, hi, notes)
      join public.program_days d on d.program_id = pid and d.day_index = v.day_idx
      join public.exercises e on e.slug = v.slug;

      raise notice 'PPL rest-cadence seeded for %', acct;
    end if;

  end loop;
end $$;
