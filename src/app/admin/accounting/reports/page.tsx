import Link from "next/link";
import { Section } from "@/components/admin/investor-directory/ui";
import { requirePermissionPage } from "@/lib/api/permissions";
import { listCustomers, listInvoices, customerLabel } from "@/lib/accounting/server";
import { AGING_BUCKETS, agingReport, fmtDate, money, todayPT } from "@/lib/accounting/core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

/** Accounting › Reports: A/R aging by customer, from sent invoices with a balance. */
export default async function AccountingReportsPage() {
  await requirePermissionPage("manage_billing");
  const [invoices, customers] = await Promise.all([listInvoices(), listCustomers({ includeArchived: true })]);
  const names = new Map(customers.map((c) => [c.id, customerLabel(c)]));
  const today = todayPT();
  const r = agingReport(invoices, (id) => names.get(id) ?? "Unknown customer", today);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
      <Section title={`A/R aging as of ${fmtDate(today)} (PT)`} icon="ti-hourglass">
        {r.rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">Nothing is owed right now. Sent invoices with a balance show here by how late they are.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-medium text-slate-500">
                  <th className="px-4 py-2">Customer</th>
                  {AGING_BUCKETS.map((b) => <th key={b} className="px-2 py-2 text-right">{b === "Current" ? "Not yet due" : `${b} days late`.replace("Over 90 days late", "Over 90 days")}</th>)}
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.customerId} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-800">{row.customer}</td>
                    {AGING_BUCKETS.map((b) => <td key={b} className={`px-2 py-2 text-right tabular-nums ${row.buckets[b] && b !== "Current" ? "text-red-700" : "text-slate-700"}`}>{row.buckets[b] ? money(row.buckets[b]) : ""}</td>)}
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{money(row.total)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2">Total</td>
                  {AGING_BUCKETS.map((b) => <td key={b} className="px-2 py-2 text-right tabular-nums">{money(r.totals[b])}</td>)}
                  <td className="px-4 py-2 text-right tabular-nums">{money(r.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-slate-100 px-4 py-2 text-[11.5px] text-slate-500">Source: sent invoices less recorded payments. Drafts, scheduled and void invoices are left out. <Link href="/admin/accounting/invoices" className="text-[#1A6CE4]">Open invoices</Link></p>
      </Section>
      <Section title="Profit and loss, balance sheet" icon="ti-report-money">
        <p className="px-4 py-3 text-[12.5px] text-slate-500">Next phase. They build from categorized Bank transactions, so categorizing in Bank now fills them in later.</p>
      </Section>
    </div>
  );
}
