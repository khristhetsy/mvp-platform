import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function PlatformEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: Readonly<{
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-[var(--shadow-panel)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--blue-muted)] text-[var(--blue)]">
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-[var(--navy)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
