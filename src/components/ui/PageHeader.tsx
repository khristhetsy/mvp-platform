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
    <header className="mb-6 border-b border-slate-200/90 pb-6 enterprise-animate-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--navy)] lg:text-[1.65rem]">{title}</h1>
          {description ? (
            <p className="mt-2.5 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
          ) : null}
          {metadata ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-slate-600">{metadata}</p>
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
