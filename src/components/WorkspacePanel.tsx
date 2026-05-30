import type { ReactNode } from "react";

export function WorkspacePanel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: Readonly<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
