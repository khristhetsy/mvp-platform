import { useTranslations } from "next-intl";
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
  const t = useTranslations("adminCmp");
  const lastUpdated = formatLastUpdated(loadedAt);

  return (
    <PageHeader
      eyebrow={t("icapos_admin")}
      title={t("operations_command_center")}
      description={t("institutional_oversight_for_company_reviews")}
      metadata={
        lastUpdated
          ? `Last updated ${lastUpdated} UTC · Preview build: admin-command-center`
          : "Preview build: admin-command-center"
      }
      queueIndicator={
        pendingCount > 0 ? (
          <StatusBadge label={`${pendingCount} pending reviews`} status="warning" dot />
        ) : (
          <StatusBadge label={t("review_queue_clear")} status="success" dot />
        )
      }
      actions={
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="cap-btn-secondary inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-xs font-medium"
            >
              {action.label}
            </Link>
          ))}
        </div>
      }
    />
  );
}
