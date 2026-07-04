"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Flag, House, Timer, TrendingUp } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", Icon: House },
  { href: "/plan", label: "Plan", Icon: CalendarRange },
  { href: "/circuits", label: "Circuits", Icon: Timer },
  { href: "/progress", label: "Progress", Icon: TrendingUp },
  { href: "/race", label: "Race", Icon: Flag },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-100 ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent shadow-glow-sm" />
              )}
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2.4 : 2}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
