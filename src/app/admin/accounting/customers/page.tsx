import { requirePermissionPage } from "@/lib/api/permissions";
import { listCustomers, listInvoices } from "@/lib/accounting/server";
import { balanceDue, displayStatus, todayPT } from "@/lib/accounting/core";
import { CustomersClient, type CustomerRow } from "@/components/admin/accounting/CustomersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

export default async function AccountingCustomersPage() {
  await requirePermissionPage("manage_billing");
  const [customers, invoices] = await Promise.all([listCustomers({ includeArchived: true }), listInvoices()]);
  const today = todayPT();
  const rows: CustomerRow[] = customers.map((c) => {
    const mine = invoices.filter((i) => i.customer_id === c.id);
    return {
      ...c,
      invoiceCount: mine.length,
      openCents: mine.filter((i) => i.status === "sent").reduce((t, i) => t + balanceDue(i), 0),
      overdueCents: mine.filter((i) => displayStatus(i, today) === "overdue").reduce((t, i) => t + balanceDue(i), 0),
    };
  });
  return (
    <div className="space-y-3 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Customers</h1>
      <CustomersClient rows={rows} />
    </div>
  );
}
