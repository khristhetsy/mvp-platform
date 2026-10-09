import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { Section } from "@/components/admin/investor-directory/ui";
import { StatusTag } from "@/components/admin/accounting/ui";
import { requirePermissionPage } from "@/lib/api/permissions";
import { accountingSummary, listInvoices } from "@/lib/accounting/server";
import { displayStatus, fmtDate, fmtStampPT, money, todayPT } from "@/lib/accounting/core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounting" };

/** Accounting › Dashboard. Every figure is read straight from the accounting tables. */
export default async function AccountingDashboardPage() {
  await requirePermissionPage("manage_billing");
  const [s, invoices] = await Promise.all([accountingSummary(), listInvoices({ limit: 8 })]);
  const today = todayPT();

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Accounting</h1>
        <p className="mt-1 text-[13px] text-slate-500">Invoices, receivables and the Bank of America feed. Customers pay by bank transfer; nothing is charged through iCapOS.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
        <MetricCard audience="admin" label="Open receivables" value={money(s.openCents)} detail={`${s.openCount} sent invoice${s.openCount === 1 ? "" : "s"} awaiting payment`} href="/admin/accounting/invoices" />
        <MetricCard audience="admin" label="Overdue" value={money(s.overdueCents)} detail={`${s.overdueCount} invoice${s.overdueCount === 1 ? "" : "s"} past the due date`}
          flag={s.overdueCount > 0 ? { text: "Send reminders from each invoice", tone: "bad" } : null} href="/admin/accounting/reports" />
        <MetricCard audience="admin" label="Scheduled" value={money(s.scheduledCents)} detail={`${s.scheduledCount} invoice${s.scheduledCount === 1 ? "" : "s"} that email themselves on their date · ${s.draftCount} draft${s.draftCount === 1 ? "" : "s"}`} href="/admin/accounting/invoices" />
        <MetricCard audience="admin" label="Received, last 30 days" value={money(s.paid30Cents)} detail={`${s.paid30Count} payment${s.paid30Count === 1 ? "" : "s"} recorded`} href="/admin/accounting/payments" />
      </div>

      <Section title="Bank" icon="ti-building-bank" action={<Link href="/admin/accounting/bank" className="text-[12.5px] text-[#1A6CE4]">Open Bank →</Link>}>
        <div className="px-4 py-3 text-[13px] text-slate-700">
          {s.bankBalanceCents != null
            ? <>Balance {money(s.bankBalanceCents)} as of {fmtStampPT(s.bankBalanceAt)} · {s.bankToReview} transaction{s.bankToReview === 1 ? "" : "s"} to review</>
            : s.plaidReady ? "No bank connected yet. Connect Bank of America from Bank." : "Plaid keys aren't set yet. Bank file imports work now; the live feed starts once the keys are in Vercel."}
        </div>
      </Section>

      <Section title="Latest invoices" icon="ti-receipt" action={<Link href="/admin/accounting/invoices/new" className="text-[12.5px] text-[#1A6CE4]">New invoice →</Link>}>
        {invoices.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No invoices yet.</p> : invoices.map((i) => (
          <Link key={i.id} href={`/admin/accounting/invoices/${i.id}`} className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-[13px] first:border-t-0 hover:bg-slate-50">
            <div className="min-w-0 flex-1"><div className="text-slate-800">{i.invoice_number} · {i.customerName}</div><div className="text-[12px] text-slate-500">{fmtDate(i.issue_date)} · due {fmtDate(i.due_date)}</div></div>
            <span className="tabular-nums text-slate-800">{money(i.total_cents)}</span>
            <StatusTag status={displayStatus(i, today)} />
          </Link>
        ))}
      </Section>
    </div>
  );
}
