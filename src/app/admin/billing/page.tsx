import { AppShell } from "@/components/AppShell";
import { AdminBillingClient, type UpgradeRequest } from "@/components/admin/billing/AdminBillingClient";
import { OrgBillingProfileCard } from "@/components/admin/billing/OrgBillingProfileCard";
import { listUpgradeRequestsForAdmin } from "@/lib/billing/upgrade-requests";
import { listBillingCustomers, getBillingStats, getWebhookHealth } from "@/lib/billing/admin-billing";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing & upgrades" };

export default async function AdminBillingPage() {
  const profile = await requireRole(["admin", "analyst"]);

  const customers = await listBillingCustomers().catch(() => []);
  const [stats, health] = await Promise.all([getBillingStats(customers), getWebhookHealth(customers)]);

  let upgradeRequests: UpgradeRequest[] = [];
  try {
    const raw = await listUpgradeRequestsForAdmin(100);
    upgradeRequests = raw.map((r) => ({
      id: r.id,
      name: r.profiles?.full_name ?? r.profiles?.email ?? "Unknown user",
      email: r.profiles?.email ?? "—",
      type: r.request_type,
      plan: r.requested_plan ? (PLAN_LABELS[r.requested_plan as keyof typeof PLAN_LABELS] ?? r.requested_plan) : "—",
      feature: r.feature_key ?? "—",
      status: r.status,
      createdAt: r.created_at,
    }));
  } catch { /* best-effort */ }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Billing"
      profileEmail={profile.email ?? undefined}
    >
      <div className="mb-6 border-b border-slate-200 px-1 pb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Admin workspace</p>
        <h1 className="mt-0.5 text-[22px] font-medium tracking-tight text-slate-950">Billing &amp; upgrades</h1>
        <p className="mt-0.5 text-sm text-slate-600">Plans, invoices, and statements for every client. Charging runs in Lemon Squeezy — this view is read-only.</p>
      </div>

      <OrgBillingProfileCard />

      <AdminBillingClient customers={customers} stats={stats} health={health} upgradeRequests={upgradeRequests} />
    </AppShell>
  );
}
