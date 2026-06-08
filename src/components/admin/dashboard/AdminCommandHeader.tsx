import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatLastUpdated } from "@/lib/ui/format-display";

const QUICK_ACTIONS = [
  { href: "/admin/reports", label: "View Reports" },
  { href: "/admin/companies", label: "Review Companies" },
  { href: "/admin/spvs", label: "Open SPVs" },
  { href: "/admin/compliance", label: "Compliance Center" },
] as const;

export function AdminCommandHeader({
  pendingCount,
  loadedAt,
}: Readonly<{
  pendingCount: number;
  loadedAt: string;
}>) {
  const lastUpdated = formatLastUpdated(loadedAt);

  return (
    <PageHeader
      eyebrow="CapitalOS admin"
      title="Operations Command Center"
      description="Institutional oversight for company reviews, investor approvals, compliance, SPV operations, and platform health."
      metadata={
        lastUpdated
          ? `Last updated ${lastUpdated} UTC · Preview build: admin-command-center`
          : "Preview build: admin-command-center"
      }
      queueIndicator={
        pendingCount > 0 ? (
          <StatusBadge label={`${pendingCount} pending reviews`} status="warning" dot />
        ) : (
          <StatusBadge label="Review queue clear" status="success" dot />
        )
      }
      actions={
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              {action.label}
            </Link>
          ))}
        </div>
      }
    />
  );
}
