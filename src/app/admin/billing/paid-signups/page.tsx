import { AppShell } from "@/components/AppShell";
import { BillingTabs } from "@/components/admin/billing/BillingTabs";
import { PaidSignupsClient, type PaidSignupRowView } from "@/components/admin/billing/PaidSignupsClient";
import { requirePermissionPage } from "@/lib/api/permissions";
import { listPaidSignupsForAdmin } from "@/lib/billing/paid-signup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paid signups" };

/** Admin, Billing, Paid signups: people who paid before creating a login (manage_billing). */
export default async function AdminPaidSignupsPage() {
  const { profile } = await requirePermissionPage("manage_billing");
  const list = await listPaidSignupsForAdmin().catch(() => []);
  const rows: PaidSignupRowView[] = list.map((r) => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
    company: r.company,
    plan_type: r.plan_type,
    status: r.status,
    paid_at: r.paid_at,
    login_email_sent_at: r.login_email_sent_at,
    claimed_at: r.claimed_at,
  }));

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Billing"
      profileEmail={profile.email ?? undefined}
    >
      <div className="mb-4 px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Admin workspace</p>
        <h1 className="mt-0.5 text-[22px] font-medium tracking-tight text-slate-950">Billing &amp; upgrades</h1>
        <p className="mt-0.5 text-sm text-slate-600">Founders who paid first. Their login is created from a private link in the payment email.</p>
      </div>
      <BillingTabs active="paid-signups" unclaimedCount={rows.filter((r) => r.status === "paid").length} />
      <PaidSignupsClient initialRows={rows} />
    </AppShell>
  );
}
