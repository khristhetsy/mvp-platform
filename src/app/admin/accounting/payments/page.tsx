import Link from "next/link";
import { requirePermissionPage } from "@/lib/api/permissions";
import { listPayments } from "@/lib/accounting/server";
import { PAYMENT_METHODS, fmtDate, money } from "@/lib/accounting/core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

/** Accounting › Payments: every payment recorded against an invoice, newest first. */
export default async function AccountingPaymentsPage() {
  await requirePermissionPage("manage_billing");
  const rows = await listPayments();
  const total = rows.reduce((t, r) => t + r.amount_cents, 0);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Payments</h1>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center border-b border-slate-100 px-4 py-2.5 text-[12.5px] text-slate-600">
          {rows.length} payment{rows.length === 1 ? "" : "s"} · {money(total)} received
          <span className="ml-auto text-slate-500">Record payments on an invoice, or match deposits in Bank.</span>
        </div>
        {rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">No payments recorded yet.</p> : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-medium text-slate-500">
                <th className="px-4 py-2">Received</th><th className="px-2 py-2">Invoice</th><th className="px-2 py-2">Customer</th>
                <th className="hidden px-2 py-2 md:table-cell">Method</th><th className="hidden px-2 py-2 lg:table-cell">Reference</th><th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600">{fmtDate(p.paid_on)}</td>
                  <td className="px-2 py-2"><Link href={`/admin/accounting/invoices/${p.invoice_id}`} className="font-medium text-slate-900 hover:text-[#1A6CE4]">{p.invoice_number}</Link></td>
                  <td className="px-2 py-2 text-slate-700">{p.customerName}</td>
                  <td className="hidden px-2 py-2 text-slate-600 md:table-cell">{PAYMENT_METHODS.find((m) => m.id === p.method)?.label ?? p.method}{p.bank_transaction_id ? " · from Bank" : ""}</td>
                  <td className="hidden max-w-[260px] truncate px-2 py-2 text-slate-500 lg:table-cell">{p.reference ?? ""}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-900">{money(p.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
