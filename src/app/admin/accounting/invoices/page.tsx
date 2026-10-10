import { requirePermissionPage } from "@/lib/api/permissions";
import { listInvoices } from "@/lib/accounting/server";
import { InvoicesListClient } from "@/components/admin/accounting/InvoicesListClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices" };

export default async function AccountingInvoicesPage() {
  await requirePermissionPage("manage_billing");
  const rows = await listInvoices();
  return (
    <div className="space-y-3 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Invoices</h1>
      <InvoicesListClient rows={rows} />
    </div>
  );
}
