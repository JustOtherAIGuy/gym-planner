-- HYROX Toronto 13-week plan — personal seed for vishrutshah121@gmail.com
-- Run with service role (dashboard SQL editor). Safe to re-run: the program
-- block is skipped if it already exists; everything else upserts.
--
-- Prerequisites: 0002_hyrox.sql applied; the user created in Auth.

-- ── 1. Exercise library additions (global; service-role only) ────────────────
insert into public.exercises (slug, name, primary_muscle, equipment, is_compound, modality) values
  ('run',               'Run',                'full-body', 'bodyweight', true, 'cardio'),
  ('skierg',            'SkiErg',             'full-body', 'machine',    true, 'cardio'),
  ('sled-push',         'Sled Push',          'quads',     'sled',       true, 'station'),
  ('sled-pull',         'Sled Pull',          'back',      'sled',       true, 'station'),
  ('burpee-broad-jump', 'Burpee Broad Jump',  'full-body', 'bodyweight', true, 'station'),
  ('sandbag-lunge',     'Sandbag Lunge',      'quads',     'sandbag',    true, 'station')
on conflict (slug) do update set modality = excluded.modality;

update public.exercises set modality = 'cardio'  where slug = 'rowing-erg';
update public.exercises set modality = 'station' where slug = 'farmer-carry';

do $$
declare
  uid uuid;
  pid uuid;
  ph1 uuid; ph2 uuid; ph3 uuid; ph4 uuid;
begin
  select id into uid from auth.users where email = 'vishrutshah121@gmail.com';
  if uid is null then
    raise exception 'User vishrutshah121@gmail.com not found — create the account first.';
  end if;

  -- ── 2. Metric targets (upsert) ──────────────────────────────────────────────
  insert into public.metric_targets
    (user_id, metric, baseline_value, baseline_date, targets, target_low, target_high, direction)
  values
    (uid, 'bodyweight', 91, '2026-07-01',
     '[{"at_weeks":13,"value":85},{"at_weeks":52,"value":77}]'::jsonb, null, null, 'desc'),
    (uid, 'run_5k_sec', null, '2026-07-02',
     '[{"at_weeks":13,"value":1350},{"at_weeks":52,"value":1230}]'::jsonb, null, null, 'desc'),
    (uid, 'weekly_run_km',     null, null, null, 30,   50,    'asc'),
    (uid, 'protein_g',         null, null, null, 140,  160,   'asc'),
    (uid, 'fat_g',             null, null, null, 60,   70,    'desc'),
    (uid, 'calories_rest',     null, null, null, 2300, 2300,  'desc'),
    (uid, 'calories_training', null, null, null, 2750, 2750,  'desc'),
    (uid, 'steps',             null, null, null, 8000, 10000, 'asc')
  on conflict (user_id, metric) do update set
    baseline_value = excluded.baseline_value,
    baseline_date  = excluded.baseline_date,
    targets        = excluded.targets,
    target_low     = excluded.target_low,
    target_high    = excluded.target_high,
    direction      = excluded.direction;

  -- ── 3. Races ────────────────────────────────────────────────────────────────
  if not exists (select 1 from public.races where user_id = uid and name = 'HYROX Toronto') then
    insert into public.races (user_id, name, location, division, event_date, status, note) values
      (uid, 'HYROX Toronto',   'Enercare Centre, Toronto', 'open', '2026-10-01', 'waitlist',
       'Primary target — sold out, on waitlist. Race window Oct 1–4.'),
      (uid, 'HYROX Boston',    'Boston',                   'open', '2026-10-08', 'backup',
       'Backup one week later — plan unchanged. Window Oct 8–11.'),
      (uid, 'HYROX Vancouver', 'Vancouver',                'open', '2026-12-18', 'backup',
       'Alternative if the fall races fall through. Window Dec 18–20.');
  end if;

  -- ── 4. Pro-ready checklist ──────────────────────────────────────────────────
  insert into public.checklist_items (user_id, slug, label, target_text, sort_index) values
    (uid, 'race-weight',   'Lean race weight',            '~77–80 kg lean',                    0),
    (uid, '5k-time',       '5 km time',                   '20–21 min',                         1),
    (uid, 'fatigued-pace', 'Fatigued running pace',       '4:45–5:00/km across all 8 km',      2),
    (uid, 'weekly-volume', 'Weekly running volume',       '40–50 km/week',                     3),
    (uid, 'squat-15bw',    'Back squat',                  '~1.5× bodyweight',                  4),
    (uid, 'deadlift-2bw',  'Deadlift',                    '~2× bodyweight',                    5),
    (uid, 'farmers-pro',   'Farmers carry at Pro load',   '2×32 kg for 200 m',                 6),
    (uid, 'wallball-pro',  'Wall balls at Pro spec',      '9 kg ×100 in ≤4 sets',              7),
    (uid, 'sandbag-pro',   'Sandbag lunges at Pro load',  '30 kg for 100 m',                   8),
    (uid, 'sled-pro',      'Sleds at Pro loads',          'Push 202 kg · pull 153 kg (50 m)',  9)
  on conflict (user_id, slug) do nothing;

  -- ── 5. Forecast calibration baselines (overwrite via Progress after week 1) ─
  insert into public.forecast_targets
    (user_id, exercise_id, metric, baseline_value, baseline_date, targets, curve)
  select uid, e.id, '1rm', v.base, '2026-07-02',
         jsonb_build_array(jsonb_build_object('at_weeks', 13, 'value', v.wk13)),
         'linear'
  from (values
    ('back-squat',        62.5, 100.0),
    ('romanian-deadlift', 66.0,  99.0),
    ('bench-press',       66.5,  84.0),
    ('barbell-row',       70.0,  85.0),
    ('overhead-press',    44.0,  55.0)
  ) as v(slug, base, wk13)
  join public.exercises e on e.slug = v.slug
  on conflict (user_id, exercise_id, metric) do nothing;

  -- ── 6. The 13-week program (skipped entirely if it already exists) ──────────
  if exists (select 1 from public.programs where user_id = uid and name = 'HYROX Toronto 13-Week') then
    raise notice 'Program already seeded — skipping.';
    return;
  end if;

  insert into public.programs (user_id, name, description, status, start_date)
  values (uid, 'HYROX Toronto 13-Week',
          'Return-to-fitness → first full solo HYROX (Men''s Open). Arrive healthy and finish strong. Week 1 = calibrate every lift (~2 reps in reserve), then double progression: top of the rep range on all sets → add weight (+2.5–5 kg lower, +2.5 kg upper).',
          'active', '2026-07-02')
  returning id into pid;

  insert into public.program_phases (program_id, phase_index, name, focus, start_date, end_date) values
    (pid, 0, 'Foundation',     'Re-groove movement, gentle aerobic base, condition joints. Calibrate every lift in week 1. Longest run 2 → 3 km.',                        '2026-07-02', '2026-07-22'),
    (pid, 1, 'Build the engine','Grow running volume ~10%/week + intervals, learn the stations. 4 days when fresh. Long run 4 → 6 km.',                                    '2026-07-23', '2026-08-19'),
    (pid, 2, 'HYROX-specific', 'Compromised running (run → station → run), race pacing, grip. Strength shifts to maintenance — never wreck running recovery.',            '2026-08-20', '2026-09-16'),
    (pid, 3, 'Peak + taper',   'Dress rehearsal early week 12 (¾ HYROX at controlled effort), deload ~15%, then rest — race-week legs stay fresh.',                       '2026-09-17', '2026-10-01');
  select id into ph1 from public.program_phases where program_id = pid and phase_index = 0;
  select id into ph2 from public.program_phases where program_id = pid and phase_index = 1;
  select id into ph3 from public.program_phases where program_id = pid and phase_index = 2;
  select id into ph4 from public.program_phases where program_id = pid and phase_index = 3;

  insert into public.program_days (program_id, day_index, name, rest_day, phase_id) values
    -- Phase 1 — Foundation
    (pid,  0, 'Full-Body A',            false, ph1),
    (pid,  1, 'Easy Run',               false, ph1),
    (pid,  2, 'Full-Body B',            false, ph1),
    (pid,  3, 'Zone 2 (optional)',      false, ph1),
    (pid,  4, 'Rest — 8–10k steps',     true,  ph1),
    -- Phase 2 — Build the engine
    (pid,  5, 'Legs & Power',           false, ph2),
    (pid,  6, 'Intervals',              false, ph2),
    (pid,  7, 'Upper & Stations',       false, ph2),
    (pid,  8, 'Long Easy Run',          false, ph2),
    (pid,  9, 'Rest — 8–10k steps',     true,  ph2),
    -- Phase 3 — HYROX-specific
    (pid, 10, '1 km Repeats',           false, ph3),
    (pid, 11, 'Strength Maintenance',   false, ph3),
    (pid, 12, 'HYROX Circuit',          false, ph3),
    (pid, 13, 'Long Run / Simulation',  false, ph3),
    (pid, 14, 'Rest — 8–10k steps',     true,  ph3),
    -- Phase 4 — Peak + taper
    (pid, 15, 'Dress Rehearsal (¾ HYROX)', false, ph4),
    (pid, 16, 'Taper — Easy + Strides', false, ph4),
    (pid, 17, 'Rest & Mobility',        true,  ph4);

  insert into public.program_exercises
    (program_day_id, exercise_id, order_index, target_sets, target_reps_low, target_reps_high, notes)
  select d.id, e.id, v.ord, v.sets, v.lo, v.hi, v.notes
  from (values
    -- Day 0 · Full-Body A
    (0, 'back-squat',            0, 3, 10, 12, 'Goblet squat if the bar feels rough — depth over load'::text),
    (0, 'dumbbell-bench-press',  1, 3, 10, 12, null::text),
    (0, 'seated-cable-row',      2, 3, 12, 12, null),
    (0, 'romanian-deadlift',     3, 3, 10, 10, 'DBs fine — feel hamstrings, flat back'),
    (0, 'farmer-carry',          4, 3,  1,  1, '30–40 m per carry, race load is 2×24 kg'),
    (0, 'plank',                 5, 3,  1,  1, 'Hold 30–45 s'),
    -- Day 1 · Easy Run
    (1, 'run',                   0, 1,  1,  1, 'Run/walk 20–25 min easy: 4 min jog / 1 min walk × 4–5, conversational'),
    -- Day 2 · Full-Body B
    (2, 'leg-press',             0, 3, 10, 10, 'Or split squat'),
    (2, 'lat-pulldown',          1, 3, 12, 12, null),
    (2, 'seated-dumbbell-press', 2, 3, 10, 10, null),
    (2, 'hip-thrust',            3, 3, 12, 12, 'Or back extension'),
    (2, 'wall-ball',             4, 3, 12, 12, 'Race spec: 6 kg to 3 m target'),
    (2, 'hanging-leg-raise',     5, 3, 10, 10, null),
    -- Day 3 · Zone 2 (optional)
    (3, 'rowing-erg',            0, 1,  1,  1, '25–30 min easy zone 2 — bike, row, or incline walk'),
    -- Day 5 · Legs & Power
    (5, 'back-squat',            0, 4,  8,  8, null),
    (5, 'romanian-deadlift',     1, 3,  8,  8, null),
    (5, 'walking-lunge',         2, 3, 12, 12, '12 per leg'),
    (5, 'sled-push',             3, 4,  1,  1, '15 m heavy — or heavy leg press + trap-bar carries'),
    (5, 'plank',                 4, 3,  1,  1, 'Core: hold 45–60 s'),
    -- Day 6 · Intervals
    (6, 'run',                   0, 6,  1,  1, '400 m hard-but-repeatable intervals, 1–2 min easy jog between. Build 6 → 8 reps, then 800 m repeats by week 7'),
    -- Day 7 · Upper & Stations
    (7, 'overhead-press',        0, 4,  8,  8, null),
    (7, 'bench-press',           1, 4,  8,  8, null),
    (7, 'barbell-row',           2, 4, 10, 10, null),
    (7, 'pull-up',               3, 3,  1, 10, 'To max — assisted is fine'),
    (7, 'wall-ball',             4, 4, 15, 15, null),
    (7, 'skierg',                5, 4,  1,  1, '250 m pieces — or banded high pulls'),
    (7, 'farmer-carry',          6, 3,  1,  1, '40 m per carry'),
    -- Day 8 · Long Easy Run
    (8, 'run',                   0, 1,  1,  1, 'Long run: build 4 km → 6 km continuous, conversational. Week 6–7 add finisher: 500 m row → 200 m run → 15 wall balls × 2–3'),
    -- Day 10 · 1 km Repeats
    (10, 'run',                  0, 5,  1,  1, '1 km at goal race pace, 90 s recovery — mirrors the race''s 1 km segments. 4–5 reps'),
    -- Day 11 · Strength Maintenance
    (11, 'back-squat',           0, 4,  6,  6, 'Moderately heavy — hold strength, don''t fry your legs'),
    (11, 'romanian-deadlift',    1, 3,  6,  6, null),
    (11, 'overhead-press',       2, 3,  8,  8, null),
    (11, 'barbell-row',          3, 3,  8,  8, null),
    (11, 'farmer-carry',         4, 3,  1,  1, '40 m heavy — grip is a race weapon'),
    -- Day 12 · HYROX Circuit
    (12, 'run',                  0, 4,  1,  1, '1 km before each station — the key session: run → station → run'),
    (12, 'skierg',               1, 1,  1,  1, 'Round 1: 500 m'),
    (12, 'sled-push',            2, 1,  1,  1, 'Round 2: sled push/pull — or DB carry'),
    (12, 'wall-ball',            3, 1, 30, 30, 'Round 3: 30 reps, break into sets early'),
    (12, 'sandbag-lunge',        4, 1,  1,  1, 'Round 4: 20 lunges — DB/KB or barbell'),
    -- Day 13 · Long Run / Simulation
    (13, 'run',                  0, 1,  1,  1, '6–7 km easy — or partial race simulation as weeks progress. Week 11: half-HYROX (4 × 1 km + 4 stations in race order), test pacing and fuelling'),
    -- Day 15 · Dress Rehearsal
    (15, 'run',                  0, 5,  1,  1, '5–6 × 1 km at CONTROLLED effort — practise gear, morning meal, pacing. Early week 12 only, then cut volume'),
    (15, 'skierg',               1, 1,  1,  1, '500 m'),
    (15, 'sled-push',            2, 1,  1,  1, '15–25 m'),
    (15, 'wall-ball',            3, 1, 30, 30, 'Broken sets from rep 1'),
    (15, 'sandbag-lunge',        4, 1,  1,  1, '20 lunges'),
    -- Day 16 · Taper
    (16, 'run',                  0, 1,  1,  1, '20 min easy + a few strides. Light touches on 2–3 stations. Wed/Thu race week: rest, mobility, walk')
  ) as v(day_idx, slug, ord, sets, lo, hi, notes)
  join public.program_days d on d.program_id = pid and d.day_index = v.day_idx
  join public.exercises e on e.slug = v.slug;

  raise notice 'HYROX plan seeded for %', uid;
end $$;
