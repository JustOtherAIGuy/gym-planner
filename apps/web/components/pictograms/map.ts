import type { GlyphName } from "./glyphs";

/** Every seeded slug → glyph. Unknown slugs fall through the resolvers below. */
export const SLUG_TO_GLYPH: Record<string, GlyphName> = {
  // Squat pattern
  "back-squat": "squat",
  "front-squat": "squat",
  "goblet-squat": "squat",
  "bulgarian-split-squat": "lunge",
  "walking-lunge": "lunge",
  "leg-press": "legmachine",
  "hack-squat": "legmachine",
  "leg-extension": "legmachine",
  "leg-curl": "legmachine",
  "calf-raise": "calf",
  // Hinge pattern
  deadlift: "hinge",
  "sumo-deadlift": "hinge",
  "romanian-deadlift": "hinge",
  "trap-bar-deadlift": "hinge",
  "hip-thrust": "bridge",
  "kettlebell-swing": "kbswing",
  "good-morning": "hinge",
  "back-extension": "bridge",
  // Horizontal press
  "bench-press": "bench",
  "incline-bench-press": "bench",
  "dumbbell-bench-press": "bench",
  "incline-dumbbell-press": "bench",
  "push-up": "pushup",
  dip: "pushup",
  "cable-fly": "fly",
  // Vertical press
  "overhead-press": "ohp",
  "seated-dumbbell-press": "ohp",
  "arnold-press": "ohp",
  "push-press": "ohp",
  "lateral-raise": "fly",
  "rear-delt-fly": "fly",
  // Vertical pull
  "pull-up": "pullup",
  "chin-up": "pullup",
  "lat-pulldown": "pullup",
  "neutral-pulldown": "pullup",
  // Horizontal pull
  "barbell-row": "bentrow",
  "pendlay-row": "bentrow",
  "dumbbell-row": "bentrow",
  "seated-cable-row": "bentrow",
  "t-bar-row": "bentrow",
  "face-pull": "fly",
  "inverted-row": "bentrow",
  // Arms
  "barbell-curl": "curl",
  "dumbbell-curl": "curl",
  "hammer-curl": "curl",
  "tricep-pushdown": "pressdown",
  skullcrusher: "pressdown",
  "overhead-tricep-ext": "pressdown",
  // Core
  plank: "plank",
  "ab-wheel-rollout": "plank",
  "hanging-leg-raise": "crunch",
  "cable-crunch": "crunch",
  "pallof-press": "fly",
  // Carries / conditioning
  "farmer-carry": "carry",
  "suitcase-carry": "carry",
  "kettlebell-clean": "kbswing",
  "kettlebell-snatch": "kbswing",
  "wall-ball": "wallball",
  burpee: "burpee",
  "rowing-erg": "rowerg",
  // HYROX
  run: "run",
  skierg: "skierg",
  "sled-push": "sledpush",
  "sled-pull": "sledpull",
  "burpee-broad-jump": "burpee",
  "sandbag-lunge": "lunge",
};

/** cardio_logs.kind / HYROX station kinds → glyph. */
export const KIND_TO_GLYPH: Record<string, GlyphName> = {
  run: "run",
  ski: "skierg",
  row: "rowerg",
  bike: "legmachine",
  sled_push: "sledpush",
  sled_pull: "sledpull",
  burpee_broad_jump: "burpee",
  farmers_carry: "carry",
  sandbag_lunge: "lunge",
};

/** Free-text labels (circuit stations) → best-guess glyph. Order matters. */
const LABEL_RULES: [RegExp, GlyphName][] = [
  [/ski/i, "skierg"],
  [/row/i, "rowerg"],
  [/sled.*pull|pull.*sled/i, "sledpull"],
  [/sled/i, "sledpush"],
  [/burpee/i, "burpee"],
  [/wall.?ball|thruster|med.?ball/i, "wallball"],
  [/swing|kettlebell|kb\b/i, "kbswing"],
  [/squat/i, "squat"],
  [/lunge/i, "lunge"],
  [/deadlift|rdl|hinge/i, "hinge"],
  [/bench|chest|push.?up|press.?up/i, "bench"],
  [/press|jerk/i, "ohp"],
  [/pull.?up|chin|pulldown/i, "pullup"],
  [/carry|farmer/i, "carry"],
  [/plank|hold/i, "plank"],
  [/crunch|sit.?up|abs|leg raise|v.?up/i, "crunch"],
  [/curl/i, "curl"],
  [/run|sprint|shuttle/i, "run"],
  [/jump|hop|skip/i, "burpee"],
];

export function glyphForLabel(label: string): GlyphName {
  for (const [re, glyph] of LABEL_RULES) {
    if (re.test(label)) return glyph;
  }
  return "barbell";
}

/** Resolver used everywhere: slug wins, then kind, then label, then fallback. */
export function resolveGlyph(input: {
  slug?: string | null;
  kind?: string | null;
  label?: string | null;
}): GlyphName {
  if (input.slug && SLUG_TO_GLYPH[input.slug]) return SLUG_TO_GLYPH[input.slug]!;
  if (input.kind && KIND_TO_GLYPH[input.kind]) return KIND_TO_GLYPH[input.kind]!;
  if (input.label) return glyphForLabel(input.label);
  return "barbell";
}
