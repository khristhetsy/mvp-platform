import { AppShell } from "@/components/AppShell";
import { BillingTabs } from "@/components/admin/billing/BillingTabs";
import { WirePaymentsClient, type AdminWireRow } from "@/components/admin/billing/WirePaymentsClient";
import { requirePermissionPage } from "@/lib/api/permissions";
import { getWireInstructions, listWireInvoicesForAdmin } from "@/lib/billing/wire";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wire payments" };

/** Admin, Billing, Wire payments: Premium invoices paid by bank wire (manage_billing). */
export default async function AdminBillingWirePage() {
  const { profile } = await requirePermissionPage("manage_billing");
  const [invoices, instructions] = await Promise.all([
    listWireInvoicesForAdmin().catch(() => []),
    getWireInstructions(),
  ]);
  const rows: AdminWireRow[] = invoices.map((i) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    profile_id: i.profile_id,
    billing_cycle: i.billing_cycle,
    amount_cents: i.amount_cents,
    status: i.status,
    issued_at: i.issued_at,
    due_at: i.due_at,
    received_at: i.received_at,
    reminder_sent_at: i.reminder_sent_at,
    is_renewal: i.is_renewal,
    founderName: i.founderName,
    founderEmail: i.founderEmail,
    companyName: i.companyName,
    daysOverdue: i.daysOverdue,
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
        <p className="mt-0.5 text-sm text-slate-600">Premium is paid by bank wire. Staff confirm each wire here; nothing is charged through iCapOS.</p>
      </div>
      <BillingTabs active="wire" overdueCount={rows.filter((r) => r.status === "overdue").length} />
      <WirePaymentsClient initialRows={rows} initialInstructions={instructions} />
    </AppShell>
  );
}
