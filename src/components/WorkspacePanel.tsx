import type { ReactNode } from "react";

export function WorkspacePanel({
  title,
  subtitle,
  action,
  children,
  className = "",
  provenance,
  stackActionOnMobile = false,
}: Readonly<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  provenance?: string;
  /** Phone width only: title and text take the full row, the action sits below it full width. */
  stackActionOnMobile?: boolean;
}>) {
  return (
    <section
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <div className={`min-w-0 flex-1 ${stackActionOnMobile ? "max-sm:basis-full" : ""}`}>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
          {provenance ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">{provenance}</p>
          ) : null}
        </div>
        {action ? <div className={`shrink-0 ${stackActionOnMobile ? "max-sm:w-full" : ""}`}>{action}</div> : null}
      </div>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}
