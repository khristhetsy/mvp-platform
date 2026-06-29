import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageErrorAlert } from "@/components/ui/PageErrorAlert";
import { listUpgradeRequestsForAdmin } from "@/lib/billing/upgrade-requests";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default async function AdminBillingPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("billingCompaniesAdmin.billing");
  const supabase = createServiceRoleClient();

  let upgradeRequests: Awaited<ReturnType<typeof listUpgradeRequestsForAdmin>> = [];
  let loadError: string | null = null;

  try {
    upgradeRequests = await listUpgradeRequestsForAdmin(100);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load upgrade requests";
  }

  const { count: pendingCount } = await supabase
    .from("upgrade_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("desc")}</p>
      </div>

      <WorkspacePanel
        title={t("upgradeRequests")}
        subtitle={t("countSub", { count: upgradeRequests.length, pending: pendingCount ?? 0 })}
      >
        {loadError ? (
          <PageErrorAlert message={loadError} />
        ) : upgradeRequests.length === 0 ? (
          <p className="text-sm text-slate-600">{t("none")}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {upgradeRequests.map((request) => (
              <div key={request.id} className="grid gap-2 py-4 text-sm md:grid-cols-[1.2fr_1fr_1fr]">
                <div>
                  <p className="font-medium text-slate-900">
                    {request.profiles?.full_name ?? request.profiles?.email ?? t("unknownUser")}
                  </p>
                  <p className="text-xs text-slate-500">{request.profiles?.email ?? "—"}</p>
                </div>
                <div className="text-slate-600">
                  <p>
                    <span className="font-medium text-slate-800">{t("typeLabel")}</span> {request.request_type.replaceAll("_", " ")}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">{t("planLabel")}</span>{" "}
                    {request.requested_plan
                      ? PLAN_LABELS[request.requested_plan as keyof typeof PLAN_LABELS] ?? request.requested_plan
                      : "—"}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">{t("featureLabel")}</span> {request.feature_key ?? "—"}
                  </p>
                </div>
                <div className="text-slate-600">
                  <p>
                    <span className="font-medium text-slate-800">{t("statusLabel")}</span> {request.status}
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(request.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspacePanel>
    </AppShell>
  );
}
