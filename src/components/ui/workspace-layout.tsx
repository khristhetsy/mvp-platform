import type { ReactNode } from "react";

/** Standard workspace page wrapper — consistent max-width and vertical rhythm. */
export function WorkspacePageContainer({
  children,
  className = "",
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div className={`mx-auto w-full max-w-[1600px] space-y-5 enterprise-animate-in ${className}`}>{children}</div>
  );
}

/** Section block with optional heading — use between PageHeader and primary content. */
export function PageSection({
  title,
  subtitle,
  action,
  children,
  className = "",
}: Readonly<{
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`space-y-4 ${className}`}>
      {title || subtitle || action ? (
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-[var(--navy)]">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Equal-height KPI row — 4 columns on xl. */
export function MetricGrid({ children, className = "" }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full ${className}`}>{children}</div>
  );
}

/** KPI row for 6 metrics — 3×2 on large screens. */
export function MetricGridWide({ children, className = "" }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:h-full ${className}`}>{children}</div>
  );
}

/** Primary content grid — cards or panels. */
export function ContentGrid({
  children,
  columns = 2,
  className = "",
}: Readonly<{ children: ReactNode; columns?: 1 | 2 | 3; className?: string }>) {
  const colClass =
    columns === 1 ? "grid-cols-1" : columns === 3 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2";
  return <div className={`grid gap-4 ${colClass} ${className}`}>{children}</div>;
}

/** Alias for view-mode toolbar placement at page level. */
export { ViewToolbar as PageToolbar } from "@/components/ui/ViewToolbar";
