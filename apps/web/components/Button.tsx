"use client";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "lg" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-black font-bold shadow-glow-sm active:shadow-none disabled:shadow-none",
  secondary: "bg-surface-2 text-fg font-semibold border border-line",
  ghost: "bg-transparent text-muted font-medium",
  danger: "bg-danger/15 text-danger font-semibold",
};

const SIZES: Record<Size, string> = {
  lg: "h-14 px-6 text-base rounded-2xl",
  md: "h-11 px-4 text-sm rounded-xl",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-100 active:scale-[.97] disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}
