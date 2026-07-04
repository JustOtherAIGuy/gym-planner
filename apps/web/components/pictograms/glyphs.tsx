"use client";

/**
 * OVERLOAD pictogram set — bespoke sport glyphs in the lucide geometry
 * (24×24, stroke ~1.8, round caps) so they mix natively with UI icons.
 * Abstract athlete: small circle head + limb strokes, Olympic-pictogram
 * spirit. All stroke = currentColor for tinting.
 */

export type GlyphName =
  | "squat"
  | "hinge"
  | "bench"
  | "ohp"
  | "bentrow"
  | "pullup"
  | "lunge"
  | "carry"
  | "kbswing"
  | "curl"
  | "pressdown"
  | "fly"
  | "plank"
  | "crunch"
  | "legmachine"
  | "calf"
  | "bridge"
  | "pushup"
  | "run"
  | "skierg"
  | "rowerg"
  | "sledpush"
  | "sledpull"
  | "burpee"
  | "wallball"
  | "barbell";

function PictoSvg({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Head helper — every athlete gets the same skull. */
const H = ({ x, y }: { x: number; y: number }) => (
  <circle cx={x} cy={y} r={2} fill="currentColor" stroke="none" />
);

const GLYPH_PATHS: Record<GlyphName, React.ReactNode> = {
  // Bar on the back, hips below parallel.
  squat: (
    <>
      <H x={12} y={3.5} />
      <path d="M4 7.5h16M6 5.5v4M18 5.5v4" />
      <path d="M12 7.5v4.5l-3.5 3.5.5 4.5M12 12l3.5 3.5-.5 4.5" />
    </>
  ),
  // Side-view hinge, plate at the shins.
  hinge: (
    <>
      <H x={16.5} y={5} />
      <path d="M15.5 7.5 9 12l1 5-1 4" />
      <path d="M14 9l1.5 5" />
      <circle cx={16.5} cy={16.5} r={2.6} />
      <path d="M16.5 13.9V9.5" />
    </>
  ),
  // Lying press, bar over the chest.
  bench: (
    <>
      <path d="M3 18h18" />
      <H x={5.5} y={14} />
      <path d="M7.5 14.8 15 15l3 3" />
      <path d="M11 14.8V9" />
      <path d="M6 9h10M7.5 7v4M14.5 7v4" />
    </>
  ),
  // Standing, bar locked out overhead.
  ohp: (
    <>
      <H x={12} y={7.5} />
      <path d="M5 3.5h14M6.5 2v3M17.5 2v3" />
      <path d="M8.5 8.5 7.5 4M15.5 8.5l1-4.5" />
      <path d="M12 9.5v5l-3 6.5M12 14.5l3 6.5" />
      <path d="M8.5 8.5h7" />
    </>
  ),
  // Bent-over pull, plated bar to the torso.
  bentrow: (
    <>
      <H x={17} y={5.5} />
      <path d="M16 7.5 9 11.5l1 4.5-1.5 4.5" />
      <path d="M9 11.5l2.5 4-1 5" />
      <path d="M13.5 9l.5 6" />
      <path d="M10 15h8M11.5 13.5v3M16.5 13.5v3" />
    </>
  ),
  // Hanging from the bar.
  pullup: (
    <>
      <path d="M4 3.5h16" />
      <path d="M8.5 3.5 10 8M15.5 3.5 14 8" />
      <H x={12} y={7.5} />
      <path d="M12 9.5v5l-2 3 .5 3M12 14.5l2 3-.5 3" />
    </>
  ),
  // Deep split-stance lunge, rear knee dropping.
  lunge: (
    <>
      <H x={12.5} y={3.5} />
      <path d="M12.2 5.5 11.5 11" />
      <path d="M11.5 11l4.5 2v6.5" />
      <path d="M11.5 11l-3 5.5-3 1.5" />
    </>
  ),
  // Farmers carry — loaded both hands.
  carry: (
    <>
      <H x={12} y={3.5} />
      <path d="M12 5.5v8l-2.5 7M12 13.5l2.5 7" />
      <path d="M12 7l-5 4.5v3M12 7l5 4.5v3" />
      <path d="M5.5 12.5h3M15.5 12.5h3" />
    </>
  ),
  // Kettlebell swing — arms extended, bell forward.
  kbswing: (
    <>
      <H x={9} y={4.5} />
      <path d="M9.3 6.5 8 12.5l-1.5 4 1 4.5" />
      <path d="M9 8l7.5-1.5" />
      <circle cx={18} cy={7} r={2.4} />
      <path d="M8 12.5l4 3.5-1 5" />
    </>
  ),
  // Biceps curl — elbow pinned, dumbbell rising.
  curl: (
    <>
      <path d="M9 4.5v9" />
      <path d="M9 13.5 16 9" />
      <path d="M14.6 6.8 17.4 11.2" />
      <circle cx={14.6} cy={6.8} r={1.1} fill="currentColor" stroke="none" />
      <circle cx={17.4} cy={11.2} r={1.1} fill="currentColor" stroke="none" />
    </>
  ),
  // Cable pressdown — rope splits to handles, force arrow down.
  pressdown: (
    <>
      <path d="M12 3v5.5" />
      <path d="M12 8.5 8 11.5M12 8.5l4 3" />
      <path d="M6.6 10.1l2.6 2.9M14.8 13l2.6-2.9" />
      <path d="M12 14v6M9.8 17.8l2.2 2.2 2.2-2.2" />
    </>
  ),
  // Arms-out raise / fly.
  fly: (
    <>
      <H x={12} y={4} />
      <path d="M12 6v8l-3 6.5M12 14l3 6.5" />
      <path d="M12 8H5M12 8h7" />
      <path d="M5 6.5v3M19 6.5v3" />
    </>
  ),
  // Forearm plank.
  plank: (
    <>
      <H x={5} y={11.5} />
      <path d="M7 12.8 17.5 14l2.5 3.5" />
      <path d="M8.8 13l-1 4h-3" />
    </>
  ),
  // V-sit / leg raise.
  crunch: (
    <>
      <H x={6.5} y={7} />
      <path d="M8 8.5 12 15" />
      <path d="M12 15l6.5-6" />
      <path d="M9.5 11.5l5-1.5" />
      <path d="M12 15l-1.5 5.5" />
    </>
  ),
  // Seated leg press — backrest, figure, platform.
  legmachine: (
    <>
      <path d="M4.5 8.5l3 7.5" />
      <H x={6.6} y={5.8} />
      <path d="M6.8 8.2 9.5 14.5" />
      <path d="M9.5 14.5 14.5 11.5l2.6 3.2" />
      <path d="M16 7.5l3.2 8" />
    </>
  ),
  // Heels off the floor.
  calf: (
    <>
      <H x={12} y={3.5} />
      <path d="M12 5.5v8" />
      <path d="M12 13.5l-2 5M12 13.5l2 5" />
      <path d="M9.5 18.5l.5-1.5M14.5 18.5l-.5-1.5" />
      <path d="M7 21h4M13 21h4" />
    </>
  ),
  // Glute bridge, load on the hips.
  bridge: (
    <>
      <H x={4.5} y={12} />
      <path d="M6.5 13.5 13 9.5l3.5 3.5v4" />
      <path d="M13 7.5v2" />
      <circle cx={13} cy={6} r={1.6} />
      <path d="M3 19h18" />
    </>
  ),
  // Push-up / dip plane.
  pushup: (
    <>
      <H x={5} y={9} />
      <path d="M7 10.5 18 14l2.5 3" />
      <path d="M9.5 11.3v5" />
      <path d="M3 20h18" />
    </>
  ),
  // Full stride runner.
  run: (
    <>
      <H x={14} y={3.5} />
      <path d="M13.5 5.5 11.5 11" />
      <path d="M11.5 11l4.5 2v6M11.5 11l-3 3.5 1 5.5" />
      <path d="M13 7.5l3.5 2M13.2 7 9.5 6" />
    </>
  ),
  // SkiErg double-pole pull.
  skierg: (
    <>
      <path d="M7.5 3v7M16.5 3v7" />
      <H x={12} y={6.5} />
      <path d="M12 8.5v5.5l-2 3 .5 4M12 14l2 3-.5 4" />
      <path d="M12 9.5 7.5 10M12 9.5l4.5.5" />
    </>
  ),
  // Rowing erg — flywheel left, reclined pull.
  rowerg: (
    <>
      <path d="M3.5 18h17" />
      <circle cx={5.5} cy={14} r={2.3} />
      <H x={16.5} y={7} />
      <path d="M16 9 14.5 15.5" />
      <path d="M14.5 15.5 10.5 13.5 8 15.8" />
      <path d="M15.3 11 9.5 11.5" />
      <path d="M9.5 10.2v2.6" />
    </>
  ),
  // Driving a sled forward.
  sledpush: (
    <>
      <path d="M14.5 9.5h5.5v7h-6" />
      <path d="M13 20h9" />
      <H x={5} y={6.5} />
      <path d="M6.5 8.5 11 12l-2.5 4 1.5 4" />
      <path d="M8.5 9.5l6 1.5" />
      <path d="M11 12l3.5 1.5" />
    </>
  ),
  // Rope-pulling a sled back.
  sledpull: (
    <>
      <path d="M3.5 10.5H9v6H4" />
      <path d="M2 20h8.5" />
      <H x={18.5} y={6.5} />
      <path d="M17.5 8.5l-1.5 5.5 1.5 6" />
      <path d="M9 12.5l7.5-2.5" />
      <path d="M16 13.5l-3.5 3 1 4" />
    </>
  ),
  // Star jump out of the burpee.
  burpee: (
    <>
      <H x={12} y={4} />
      <path d="M12 6v6" />
      <path d="M12 7.5 7 4.5M12 7.5l5-3" />
      <path d="M12 12l-4 5.5M12 12l4 5.5" />
      <path d="M6 21h12" />
    </>
  ),
  // Throw to the target line.
  wallball: (
    <>
      <path d="M20.5 3v6M19 3h3" />
      <H x={8.5} y={9} />
      <path d="M8.5 11v5l-2 5M8.5 16l2.5 4.5" />
      <path d="M8.5 12l4.5-4.5" />
      <circle cx={15} cy={5.5} r={2.2} />
    </>
  ),
  // Loaded bar — the generic fallback.
  barbell: (
    <>
      <path d="M4 12h16" />
      <path d="M7 8v8M17 8v8" />
      <path d="M4.5 9.5v5M19.5 9.5v5" />
    </>
  ),
};

export function Glyph({
  name,
  className,
}: {
  name: GlyphName;
  className?: string;
}) {
  return <PictoSvg className={className}>{GLYPH_PATHS[name]}</PictoSvg>;
}

/** Glyph for use INSIDE another <svg> (nested svg with explicit coords). */
export function GlyphNested({
  name,
  x,
  y,
  size,
  stroke = "currentColor",
}: {
  name: GlyphName;
  x: number;
  y: number;
  size: number;
  stroke?: string;
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPH_PATHS[name]}
    </svg>
  );
}

export const ALL_GLYPHS = Object.keys(GLYPH_PATHS) as GlyphName[];
