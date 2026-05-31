import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  metadata,
  queueIndicator,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  metadata?: string;
  queueIndicator?: ReactNode;
}>) {
  return (
    <header className="mb-8 rounded-2xl border border-slate-200/60 bg-white px-5 py-5 shadow-[var(--shadow-panel)] enterprise-animate-in lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950 lg:text-[1.75rem]">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          ) : null}
          {metadata ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-slate-400">{metadata}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {queueIndicator}
          {actions}
        </div>
      </div>
    </header>
  );
}
