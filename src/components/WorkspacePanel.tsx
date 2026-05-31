import type { ReactNode } from "react";

export function WorkspacePanel({
  title,
  subtitle,
  action,
  children,
  className = "",
  provenance,
}: Readonly<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  provenance?: string;
}>) {
  return (
    <section
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          {provenance ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">{provenance}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}
