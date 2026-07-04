"use client";

/**
 * Weekly training-load heat map: front + back athlete built from floating
 * geometric plates (one per muscle group), lit volt by sets logged this week.
 * Deliberately abstract — plates, not anatomy — to match the brand.
 */

type Region = {
  muscles: string[];
  el: React.ReactNode;
};

const R = 5; // plate corner radius

// 100×210 viewBoxes. Head/hips/shins are neutral silhouette hints.
const FRONT: Region[] = [
  {
    muscles: ["shoulders"],
    el: (
      <>
        <rect x={17} y={33} width={17} height={13} rx={R} />
        <rect x={66} y={33} width={17} height={13} rx={R} />
      </>
    ),
  },
  {
    muscles: ["chest"],
    el: <rect x={36} y={33} width={28} height={24} rx={R} />,
  },
  {
    muscles: ["core"],
    el: <rect x={38} y={61} width={24} height={31} rx={R} />,
  },
  {
    muscles: ["biceps"],
    el: (
      <>
        <rect x={11} y={49} width={12} height={23} rx={R} />
        <rect x={77} y={49} width={12} height={23} rx={R} />
      </>
    ),
  },
  {
    muscles: ["grip"],
    el: (
      <>
        <rect x={7} y={76} width={11} height={23} rx={R} />
        <rect x={82} y={76} width={11} height={23} rx={R} />
      </>
    ),
  },
  {
    muscles: ["quads"],
    el: (
      <>
        <rect x={29} y={106} width={18} height={45} rx={R} />
        <rect x={53} y={106} width={18} height={45} rx={R} />
      </>
    ),
  },
];

const BACK: Region[] = [
  {
    muscles: ["rear-delts", "shoulders"],
    el: (
      <>
        <rect x={17} y={33} width={17} height={13} rx={R} />
        <rect x={66} y={33} width={17} height={13} rx={R} />
      </>
    ),
  },
  {
    muscles: ["back"],
    el: <rect x={36} y={33} width={28} height={22} rx={R} />,
  },
  {
    muscles: ["lats"],
    el: (
      <>
        <rect x={27} y={57} width={17} height={24} rx={R} />
        <rect x={56} y={57} width={17} height={24} rx={R} />
      </>
    ),
  },
  {
    muscles: ["triceps"],
    el: (
      <>
        <rect x={11} y={49} width={12} height={23} rx={R} />
        <rect x={77} y={49} width={12} height={23} rx={R} />
      </>
    ),
  },
  {
    muscles: ["lower-back", "posterior"],
    el: <rect x={39} y={85} width={22} height={12} rx={R} />,
  },
  {
    muscles: ["glutes"],
    el: <rect x={35} y={101} width={30} height={16} rx={R} />,
  },
  {
    muscles: ["hamstrings"],
    el: (
      <>
        <rect x={29} y={121} width={18} height={34} rx={R} />
        <rect x={53} y={121} width={18} height={34} rx={R} />
      </>
    ),
  },
  {
    muscles: ["calves"],
    el: (
      <>
        <rect x={31} y={160} width={14} height={33} rx={R} />
        <rect x={55} y={160} width={14} height={33} rx={R} />
      </>
    ),
  },
];

function Silhouette({
  regions,
  counts,
  max,
  label,
  frontShins,
}: {
  regions: Region[];
  counts: Partial<Record<string, number>>;
  max: number;
  label: string;
  frontShins?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 100 210" className="h-44 w-auto">
        {/* neutral silhouette hints */}
        <g
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth={1.5}
        >
          <circle cx={50} cy={17} r={9.5} />
          <rect x={38} y={96} width={24} height={7} rx={3.5} opacity={0.6} />
          {frontShins && (
            <>
              <rect x={32} y={157} width={13} height={36} rx={R} />
              <rect x={55} y={157} width={13} height={36} rx={R} />
            </>
          )}
        </g>
        {regions.map((r, i) => {
          const count = r.muscles.reduce(
            (acc, m) => acc + (counts[m] ?? 0),
            0,
          );
          const lit = count > 0;
          const opacity = lit ? 0.18 + 0.72 * Math.min(1, count / max) : 1;
          return (
            <g key={i}>
              <g
                fill={lit ? "var(--color-accent)" : "rgba(255,255,255,0.05)"}
                fillOpacity={lit ? opacity : 1}
                stroke={
                  lit ? "var(--color-accent)" : "var(--color-line-strong)"
                }
                strokeOpacity={lit ? Math.min(1, opacity + 0.2) : 1}
                strokeWidth={1.2}
              >
                {r.el}
              </g>
            </g>
          );
        })}
      </svg>
      <span className="text-[10px] uppercase tracking-[0.18em] text-faint">
        {label}
      </span>
    </div>
  );
}

export function BodyHeatMap({
  counts,
}: {
  counts: Partial<Record<string, number>>;
}) {
  const max = Math.max(1, ...Object.values(counts).map((v) => v ?? 0));
  return (
    <div className="flex items-start justify-center gap-10">
      <Silhouette
        regions={FRONT}
        counts={counts}
        max={max}
        label="Front"
        frontShins
      />
      <Silhouette regions={BACK} counts={counts} max={max} label="Back" />
    </div>
  );
}
