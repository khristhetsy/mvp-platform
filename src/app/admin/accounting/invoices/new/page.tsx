import Link from "next/link";
import { requirePermissionPage } from "@/lib/api/permissions";
import { listCustomers } from "@/lib/accounting/server";
import { InvoiceForm } from "@/components/admin/accounting/InvoiceForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: Readonly<{ searchParams: Promise<{ customer?: string }> }>) {
  await requirePermissionPage("manage_billing");
  const [customers, sp] = await Promise.all([listCustomers(), searchParams]);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/accounting/invoices" className="text-[13px] text-[#1A6CE4]">Invoices</Link>
        <span className="text-slate-400">/</span>
        <h1 className="text-[15px] font-semibold text-slate-900">New invoice</h1>
      </div>
      <InvoiceForm customers={customers} presetCustomerId={sp.customer ?? null} />
    </div>
  );
}
