import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type Severity = "ok" | "warning" | "critical";

type HealthItem = {
  label: string;
  count: number;
  href: string;
  severity: Severity;
  emptyLabel: string;
};

function getSeverity(count: number, warnAt: number, critAt: number): Severity {
  if (count >= critAt) return "critical";
  if (count >= warnAt) return "warning";
  return "ok";
}

const DOT_CLASS: Record<Severity, string> = {
  ok:       "bg-emerald-400",
  warning:  "bg-amber-400",
  critical: "bg-red-500",
};

const COUNT_CLASS: Record<Severity, string> = {
  ok:       "text-slate-700",
  warning:  "text-amber-700",
  critical: "text-red-700",
};

export async function AdminPlatformHealthWidget() {
  const admin = createServiceRoleClient();

  const [
    pendingReviewsResult,
    pendingIntrosResult,
    criticalComplianceResult,
    pendingApprovalsResult,
  ] = await Promise.all([
    admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .in("review_status", ["pending", "submitted"]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("intro_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "reviewing"]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "critical")
      .eq("status", "open"),
    admin
      .from("investor_profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending"),
  ]);

  const pendingReviews = pendingReviewsResult.count ?? 0;
  const pendingIntros = (pendingIntrosResult as { count: number | null }).count ?? 0;
  const criticalCompliance = (criticalComplianceResult as { count: number | null }).count ?? 0;
  const pendingApprovals = pendingApprovalsResult.count ?? 0;

  const items: HealthItem[] = [
    {
      label: "Companies pending review",
      count: pendingReviews,
      href: "/admin/companies?filter=pending",
      severity: getSeverity(pendingReviews, 1, 10),
      emptyLabel: "All reviewed",
    },
    {
      label: "Intro requests pending",
      count: pendingIntros,
      href: "/admin/intro-requests?filter=pending",
      severity: getSeverity(pendingIntros, 1, 15),
      emptyLabel: "None pending",
    },
    {
      label: "Critical compliance",
      count: criticalCompliance,
      href: "/admin/companies",
      severity: getSeverity(criticalCompliance, 1, 5),
      emptyLabel: "No critical events",
    },
    {
      label: "Investor approvals",
      count: pendingApprovals,
      href: "/admin/investors",
      severity: getSeverity(pendingApprovals, 1, 25),
      emptyLabel: "All reviewed",
    },
  ];

  const criticalCount = items.filter((i) => i.severity === "critical").length;
  const warningCount  = items.filter((i) => i.severity === "warning").length;
  const allClear      = criticalCount === 0 && warningCount === 0;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Platform health</h2>
        {criticalCount > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && criticalCount === 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            {warningCount} needs attention
          </span>
        )}
        {allClear && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            All clear
          </span>
        )}
      </div>

      {/* Grid of health items */}
      <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group bg-white px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <div className="mb-1.5 flex items-start justify-between gap-1.5">
              <p className="text-[11px] leading-snug text-slate-500">{item.label}</p>
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[item.severity]}`} />
            </div>
            {item.count > 0 ? (
              <p className={`text-xl font-bold ${COUNT_CLASS[item.severity]}`}>
                {item.count}
              </p>
            ) : (
              <p className="text-xs font-medium text-emerald-600">{item.emptyLabel}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
