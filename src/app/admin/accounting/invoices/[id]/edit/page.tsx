import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermissionPage } from "@/lib/api/permissions";
import { getInvoice, getInvoiceLines, getServices, listCustomers } from "@/lib/accounting/server";
import { InvoiceForm } from "@/components/admin/accounting/InvoiceForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  await requirePermissionPage("manage_billing");
  const { id } = await params;
  const [inv, lines, customers, services] = await Promise.all([getInvoice(id), getInvoiceLines(id), listCustomers(), getServices()]);
  if (!inv) notFound();
  if (inv.status !== "draft" && inv.status !== "scheduled") redirect(`/admin/accounting/invoices/${id}`);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Link href={`/admin/accounting/invoices/${id}`} className="text-[13px] text-[#1A6CE4]">{inv.invoice_number}</Link>
        <span className="text-slate-400">/</span>
        <h1 className="text-[15px] font-semibold text-slate-900">Edit</h1>
      </div>
      <InvoiceForm
        customers={customers}
        services={services}
        initial={{ id: inv.id, invoice_number: inv.invoice_number, customer_id: inv.customer_id, entity: inv.entity, issue_date: inv.issue_date, due_date: inv.due_date, memo: inv.memo, lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unit_cents: l.unit_cents })) }}
      />
    </div>
  );
}
