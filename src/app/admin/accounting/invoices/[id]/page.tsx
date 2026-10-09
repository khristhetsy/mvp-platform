import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/lib/api/permissions";
import { getInvoiceDetail, listInvoices } from "@/lib/accounting/server";
import { InvoiceRecordClient } from "@/components/admin/accounting/InvoiceRecordClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice" };

export default async function InvoiceRecordPage({ params, searchParams }: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<{ email_error?: string }> }>) {
  await requirePermissionPage("manage_billing");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [detail, all] = await Promise.all([getInvoiceDetail(id), listInvoices()]);
  if (!detail) notFound();
  const idx = all.findIndex((r) => r.id === id);
  return (
    <div className="p-4 md:p-6">
      <InvoiceRecordClient
        invoice={detail.invoice}
        lines={detail.lines}
        customer={detail.customer}
        payments={detail.payments}
        series={detail.series}
        bankCandidates={detail.bankCandidates}
        prevId={idx > 0 ? all[idx - 1].id : null}
        nextId={idx >= 0 && idx < all.length - 1 ? all[idx + 1].id : null}
        position={idx + 1}
        total={all.length}
        emailError={sp.email_error ?? null}
      />
    </div>
  );
}
