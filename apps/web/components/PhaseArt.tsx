"use client";

/**
 * Generative phase backdrops: ridgelines that get steeper as the plan
 * intensifies — gentle base building, jagged HYROX-specific work, one big
 * peak then the taper. Plus the phase number as a giant outline numeral.
 */

const RIDGES: string[][] = [
  // 0 · Foundation — rolling hills
  [
    "M0 56 L30 50 L60 53 L90 46 L120 50 L150 44 L182 47",
    "M0 62 L36 57 L72 60 L108 54 L144 57 L182 53",
  ],
  // 1 · Build the engine — climbing
  [
    "M0 58 L30 46 L60 50 L90 38 L120 43 L150 30 L182 35",
    "M0 63 L36 55 L72 58 L108 48 L144 52 L182 42",
  ],
  // 2 · HYROX-specific — jagged
  [
    "M0 60 L28 38 L56 46 L84 24 L112 34 L140 14 L182 24",
    "M0 64 L34 50 L68 56 L102 38 L136 46 L182 30",
  ],
  // 3 · Peak + taper — the spike, then rest
  [
    "M0 52 L40 36 L70 42 L100 8 L130 32 L158 44 L182 47",
    "M0 60 L44 50 L78 54 L108 26 L140 46 L182 54",
  ],
];

export function PhaseArt({ phaseIndex }: { phaseIndex: number }) {
  const ridges = RIDGES[Math.min(phaseIndex, RIDGES.length - 1)] ?? RIDGES[0]!;
  return (
    <svg
      viewBox="0 0 182 70"
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden
      className="pointer-events-none absolute bottom-0 right-0 h-24 max-w-[60%]"
    >
      <text
        x={174}
        y={58}
        textAnchor="end"
        className="font-display"
        fontSize={64}
        fill="none"
        stroke="var(--color-accent)"
        strokeOpacity={0.1}
        strokeWidth={1.3}
      >
        {phaseIndex + 1}
      </text>
      <path
        d={ridges[0]!}
        fill="none"
        stroke="var(--color-accent)"
        strokeOpacity={0.2}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d={ridges[1]!}
        fill="none"
        stroke="var(--color-accent)"
        strokeOpacity={0.09}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Full-width faint ridge stack — ambient backdrop (login). */
export function ContourLines({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 220"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      className={`pointer-events-none ${className}`}
    >
      {[
        "M0 150 L60 122 L120 136 L180 96 L240 118 L300 78 L360 100 L400 84",
        "M0 176 L70 152 L140 164 L210 130 L280 148 L350 116 L400 130",
        "M0 200 L80 182 L160 192 L240 166 L320 180 L400 158",
      ].map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="var(--color-accent)"
          strokeOpacity={0.1 - i * 0.025}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
