export function Card({
  glow = false,
  className = "",
  id,
  children,
}: {
  glow?: boolean;
  className?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`rounded-card border border-line bg-surface-1 p-5 ${
        glow ? "shadow-glow-sm" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
      {children}
    </h2>
  );
}
