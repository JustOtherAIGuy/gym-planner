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
