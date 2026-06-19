import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Canonical empty-state panel for the platform. Other empty-state helpers
 * (PlatformEmptyState, ActionEmptyState) delegate to this so there is a single
 * implementation and a consistent look across workspaces.
 */
export function EmptyState({
  title,
  description,
  guidance,
  actionLabel,
  actionHref,
  secondaryActionLabel,
  secondaryActionHref,
  action,
  metadata,
  icon,
  variant = "card",
}: Readonly<{
  title: string;
  description: string;
  guidance?: string;
  actionLabel?: string;
  actionHref?: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  /** Custom action node — takes precedence over actionLabel/actionHref. */
  action?: ReactNode;
  metadata?: string;
  icon?: ReactNode;
  /** "card" (bordered panel) or "plain" (no chrome, for embedding). */
  variant?: "card" | "plain";
}>) {
  const containerClass =
    variant === "card"
      ? "rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-[var(--shadow-panel)] enterprise-animate-in"
      : "px-6 py-10 text-center";

  const hasLinkAction = Boolean(actionLabel && actionHref);
  const hasSecondary = Boolean(secondaryActionLabel && secondaryActionHref);

  return (
    <div className={containerClass}>
      {icon ? (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--blue-muted)] text-[var(--blue)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {guidance ? <p className="mx-auto mt-2 max-w-lg text-xs text-slate-500">{guidance}</p> : null}
      {metadata ? (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-slate-400">{metadata}</p>
      ) : null}
      {action ? (
        <div className="mt-5 flex justify-center">{action}</div>
      ) : hasLinkAction || hasSecondary ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {hasLinkAction ? (
            <Link
              href={actionHref!}
              className="cap-btn-primary inline-flex rounded-lg px-4 py-2 text-sm font-medium"
            >
              {actionLabel}
            </Link>
          ) : null}
          {hasSecondary ? (
            <Link
              href={secondaryActionHref!}
              className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {secondaryActionLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
