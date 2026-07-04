/** Typographic brand mark. The "O" carries the volt. */
export function Wordmark({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const cls =
    size === "lg"
      ? "text-[44px]"
      : size === "md"
        ? "text-2xl"
        : "text-lg";
  return (
    <span
      className={`font-display leading-none tracking-tight ${cls}`}
      aria-label="Overload"
    >
      <span className="text-accent">O</span>VERLOAD
    </span>
  );
}
