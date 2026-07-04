-- 13 hand-authored week rows for the "HYROX Toronto 13-Week" program.
-- Separate from seed_hyrox.sql (whose program block is skipped on re-run).
-- Idempotent: upserts on (program_id, week_index). Runs for BOTH accounts.
-- Derivation: phase focuses + day prescriptions; ~+10%/wk in Build with a
-- week-7 cut-back; monthly 5k tests wk 3/7/11; half-sim wk 11; dress
-- rehearsal wk 12 then −15%; race week −50–60%. Race: Thu 2026-10-01.

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
    select id into pid from public.programs
      where user_id = uid and name = 'HYROX Toronto 13-Week';
    if pid is null then
      raise notice 'skipping %: program not found', acct;
      continue;
    end if;

    insert into public.program_weeks
      (user_id, program_id, week_index, run_km, long_run_km,
       run_focus, strength_focus, station_focus, flags, note)
    select uid, pid, v.wk, v.run, v.longr, v.runf, v.strf, v.staf, v.flags, v.note
    from (values
      (1,  5.0::numeric,  2.0::numeric,
       'Run/walk 20–25 min: 4 min jog / 1 min walk ×4–5, conversational'::text,
       'Calibrate every lift at ~2 reps in reserve — these baselines drive the next 12 weeks'::text,
       'Farmers 30–40 m, wall balls 6 kg — learn positions, no heroics'::text,
       '{}'::text[],
       'Depth over load. Log everything.'::text),
      (2,  7.0,  2.5,
       'Longer jog blocks, 2–3 easy runs — still conversational',
       'Double progression starts: top of the rep range on all sets → +2.5–5 kg',
       'Farmers + wall balls slightly heavier',
       '{}'::text[],
       'If a joint complains, swap the movement, don''t push through.'),
      (3,  9.0,  3.0,
       'First fully continuous easy runs + baseline 5 km test',
       'Full-Body A/B ×2, steady adds where the top of range is hit',
       'Add SkiErg touches on the zone-2 day',
       array['5k_test']::text[],
       'Note the 5k pace — it sets interval targets for the build.'),
      (4,  10.0, 4.0,
       '6×400 m hard-but-repeatable, 1–2 min jog recovery',
       'Build phase: Legs & Power 4×8 + Upper & Stations day',
       'Sled push 15 m heavy · SkiErg 250 m pieces',
       '{}'::text[],
       'Engine phase begins — 4th training day only when fresh.'),
      (5,  11.0, 4.5,
       '8×400 m intervals',
       'Add weight wherever the top of the range was hit',
       'Farmers 40 m per carry · wall balls 4×15',
       '{}'::text[],
       '~+10% running volume — hold easy days truly easy.'),
      (6,  12.5, 5.5,
       '6×800 m repeats',
       'Hold 4×8 — quality reps over load jumps',
       'Long-run finisher: 500 m row → 200 m run → 15 wall balls ×2',
       '{}'::text[],
       'First taste of compromised running. It should feel odd.'),
      (7,  10.0, 4.0,
       'Cut-back: 4×800 m relaxed + monthly 5 km test',
       'Deload feel — leave 2–3 reps in reserve everywhere',
       'Light station touches only',
       array['cutback','5k_test']::text[],
       '−20% on purpose. Absorb the build, don''t add to it.'),
      (8,  15.0, 6.0,
       '4–5×1 km at goal race pace, 90 s recovery',
       'Shift to maintenance 4×6 moderately heavy — never wreck running recovery',
       'HYROX circuit debut: 1 km run before each station',
       '{}'::text[],
       'Compromised running is the sport now.'),
      (9,  18.0, 6.5,
       '5×1 km repeats + circuit runs',
       'Maintenance — moderately heavy, stop far from failure',
       'Circuit: ski 500 m · sled · 30 wall balls · 20 sandbag lunges · farmers 40 m heavy',
       '{}'::text[],
       'Grip is a race weapon — carry heavy every week.'),
      (10, 22.0, 7.0,
       'Peak volume: repeats + circuit + long run',
       'Maintenance 4×6, moderate loads',
       'Full circuit at race loads where possible',
       '{}'::text[],
       'Biggest week of the plan — sleep and protein are training.'),
      (11, 24.0, 7.0,
       'Half-HYROX simulation (4×1 km + 4 stations, race order) + 5 km test',
       'Light maintenance only',
       'Race-order half sim — pacing, transitions, fuelling',
       array['half_sim','5k_test']::text[],
       'Peak. Rehearse breakfast, gear and the pacing plan.'),
      (12, 15.0, 6.0,
       'Dress rehearsal early week: 5–6×1 km at CONTROLLED effort, then −15%',
       'Light touches — nothing new, nothing heavy',
       '¾ HYROX at controlled effort, Mon/Tue only',
       array['dress_rehearsal']::text[],
       'Everything after the rehearsal is recovery.'),
      (13, 8.0,  null::numeric,
       '20 min easy + a few strides — nothing hard after Tuesday',
       'Rest & mobility',
       '2–3 light station touches — transitions only',
       array['race_week']::text[],
       'Race Thu Oct 1. −50–60% volume. Race-week legs stay fresh.')
    ) as v(wk, run, longr, runf, strf, staf, flags, note)
    on conflict (program_id, week_index) do update set
      run_km         = excluded.run_km,
      long_run_km    = excluded.long_run_km,
      run_focus      = excluded.run_focus,
      strength_focus = excluded.strength_focus,
      station_focus  = excluded.station_focus,
      flags          = excluded.flags,
      note           = excluded.note;

    raise notice 'program_weeks seeded for %', acct;
  end loop;
end $$;
