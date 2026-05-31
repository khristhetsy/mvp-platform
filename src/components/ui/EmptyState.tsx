import type { ReactNode } from "react";
import Link from "next/link";

export function EmptyState({
  title,
  description,
  guidance,
  actionLabel,
  actionHref,
  metadata,
  icon,
}: Readonly<{
  title: string;
  description: string;
  guidance?: string;
  actionLabel?: string;
  actionHref?: string;
  metadata?: string;
  icon?: ReactNode;
}>) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center enterprise-animate-in">
      {icon ? <div className="mb-3 flex justify-center text-slate-400">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {guidance ? <p className="mx-auto mt-2 max-w-lg text-xs text-slate-500">{guidance}</p> : null}
      {metadata ? (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-slate-400">{metadata}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
