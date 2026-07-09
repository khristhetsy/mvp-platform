import { AppShell } from "@/components/AppShell";
import { BillingInvoiceDocument } from "@/components/admin/billing/BillingInvoiceDocument";
import { getBillingCustomerDetail } from "@/lib/billing/admin-billing";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice" };

export default async function AdminBillingInvoicePage({ params }: { params: Promise<{ id: string; invId: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id, invId } = await params;
  const detail = await getBillingCustomerDetail(id).catch(() => null);
  const invoice = detail?.invoices.find((i) => i.id === invId) ?? null;
  const customer = detail?.customer
    ? { name: detail.customer.name, email: detail.customer.email, planLabel: detail.customer.planLabel, currency: detail.customer.currency }
    : null;

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Billing"
      profileEmail={profile.email ?? undefined}
    >
      <BillingInvoiceDocument profileId={id} invoice={invoice} customer={customer} payment={detail?.payment ?? null} />
    </AppShell>
  );
}
