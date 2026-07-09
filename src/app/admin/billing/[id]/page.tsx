import { AppShell } from "@/components/AppShell";
import { BillingCustomerProfile } from "@/components/admin/billing/BillingCustomerProfile";
import { getBillingCustomerDetail } from "@/lib/billing/admin-billing";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing customer" };

export default async function AdminBillingCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const detail = await getBillingCustomerDetail(id).catch(() => ({ customer: null, invoices: [], statement: { invoicedCents: 0, paidCents: 0, dueCents: 0, currency: "USD" } }));

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Billing"
      profileEmail={profile.email ?? undefined}
    >
      <BillingCustomerProfile detail={detail} />
    </AppShell>
  );
}
