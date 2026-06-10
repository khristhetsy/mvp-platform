import type { ReactNode } from "react";
import Link from "next/link";

export const drilldownFocusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]";

export const drilldownHoverClass =
  "transition-colors hover:border-slate-300 hover:bg-slate-50/80";

export function DrilldownLink({
  href,
  children,
  className = "",
  ariaLabel,
  title,
}: Readonly<{
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  title?: string;
}>) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 text-sm font-medium text-[var(--blue)] underline-offset-2 hover:underline ${drilldownFocusClass} ${className}`}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </Link>
  );
}

export function ClickableCard({
  href,
  children,
  className = "",
  ariaLabel,
}: Readonly<{
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}>) {
  return (
    <Link
      href={href}
      className={`block h-full cursor-pointer rounded-xl no-underline ${drilldownFocusClass} ${className}`}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}

export function ActionablePanelRow({
  href,
  children,
  className = "",
  ariaLabel,
}: Readonly<{
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}>) {
  return (
    <Link
      href={href}
      className={`group -mx-2 flex gap-3 rounded-lg px-2 py-3 no-underline first:pt-0 last:pb-0 ${drilldownHoverClass} ${drilldownFocusClass} ${className}`}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
