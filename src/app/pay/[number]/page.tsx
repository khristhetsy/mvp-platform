import type { Metadata } from "next";
import { getInvoiceForPayPage, payPageData } from "@/lib/accounting/server";
import { ACCOUNTING_COPY, balanceDue, entityDisclaimer, entityName, fmtDate, money } from "@/lib/accounting/core";
import { wireInstructionsComplete } from "@/lib/billing/wire-core";
import { PayInvoiceClient } from "@/components/accounting/PayInvoiceClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay invoice", robots: { index: false, follow: false } };

/**
 * The customer's pay page from the "Pay invoice" button (approved Oct 9, 2026).
 * ACH push only: the customer sends from their own bank with the invoice
 * number as the reference; the Bank of America feed confirms the deposit.
 * No money moves through iCapOS.
 */
export default async function PayInvoicePage({ params, searchParams }: Readonly<{ params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }>) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const inv = await getInvoiceForPayPage(decodeURIComponent(number), typeof sp.t === "string" ? sp.t : "").catch(() => null);
  if (!inv) return <Shell><Terminal icon="ti-link-off" title="Link not found" message="This payment link is not valid. Use the link in your invoice email, or reply to that email for help." /></Shell>;
  if (inv.status === "void") return <Shell entity={inv.entity}><Terminal icon="ti-ban" title="Invoice cancelled" message={`Invoice ${inv.invoice_number} was cancelled, so there is nothing to pay.`} /></Shell>;

  const d = await payPageData(inv);
  const due = balanceDue(inv);
  const paid = inv.status === "paid" || due === 0;
  const ins = d.instructions;
  const ready = wireInstructionsComplete(ins);
  const rows = [
    { label: "Beneficiary", value: ins.beneficiary, copy: true },
    { label: "Bank", value: ins.bank_name, copy: false },
    { label: "Routing number (ACH)", value: ins.routing_number, copy: true, mono: true },
    { label: "Account number", value: ins.account_number, copy: true, mono: true },
    { label: "Reference (required)", value: inv.invoice_number, copy: true, strong: true },
  ].filter((r) => r.value.trim().length > 0);

  return (
    <Shell entity={inv.entity}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[#0A1A40]">{entityName(inv.entity)}</div>
          <div className="text-[12.5px] text-slate-500">Invoice {inv.invoice_number}{d.customerLabel ? ` · ${d.customerLabel}` : ""}</div>
        </div>
        {paid
          ? <span className="shrink-0 rounded-md bg-[#EAF3DE] px-2.5 py-1 text-[12px] font-medium text-[#27500A]">Paid</span>
          : <span className="shrink-0 rounded-md bg-[#FAEEDA] px-2.5 py-1 text-[12px] font-medium text-[#633806]">Due {fmtDate(inv.due_date)}</span>}
      </div>

      <div className="mt-4 text-[12px] text-slate-500">{paid ? "Amount paid" : "Amount due"}</div>
      <div className="text-[28px] font-semibold leading-tight text-[#0A1A40] tabular-nums">{money(paid ? inv.total_cents : due, inv.currency)}</div>
      {d.lines.length ? <div className="text-[12.5px] text-slate-500">{d.lines.map((l) => l.description).join(", ")}</div> : null}

      {paid ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-[#EAF3DE] px-3 py-2.5 text-[13px] text-[#27500A]">
          <i className="ti ti-circle-check text-[20px]" aria-hidden="true" />
          <div>Payment received{inv.paid_at ? ` ${fmtDate(inv.paid_at.slice(0, 10))}` : ""}. Thank you.</div>
        </div>
      ) : (
        <>
          <div className="mt-4 border-t border-slate-200 pt-3 text-[13px] font-medium text-slate-900">
            <i className="ti ti-building-bank mr-1.5 align-[-2px] text-[16px] text-[#185FA5]" aria-hidden="true" />Pay by ACH transfer from your bank
          </div>
          {ready ? (
            <PayInvoiceClient
              number={inv.invoice_number}
              token={inv.public_token}
              rows={rows}
              note={ins.notes || null}
              amount={money(due, inv.currency)}
              pdfUrl={d.pdfUrl}
              reportedAt={inv.client_reported_paid_at ?? null}
            />
          ) : (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">{ACCOUNTING_COPY.noInstructions}</p>
          )}
        </>
      )}
      {paid ? <a href={d.pdfUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"><i className="ti ti-download" aria-hidden="true" />Receipt PDF</a> : null}

      {d.series.length > 1 ? (
        <div className="mt-4 text-[12px] text-slate-500">
          <span className="font-medium text-slate-700">Payment schedule</span>
          {d.series.map((s) => <span key={s.invoice_number}> · {s.invoice_number.slice(-4)} {money(s.total_cents, inv.currency)} {fmtDate(s.due_date)}</span>)}
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ children, entity }: Readonly<{ children: React.ReactNode; entity?: string }>) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-[520px] rounded-xl border border-slate-200 bg-white p-5">{children}</div>
      <p className="mx-auto mt-3 max-w-[520px] text-center text-[11px] text-slate-400">{entity ? entityDisclaimer(entity) : ACCOUNTING_COPY.disclaimer}</p>
    </main>
  );
}

function Terminal({ icon, title, message }: Readonly<{ icon: string; title: string; message: string }>) {
  return (
    <div className="py-4 text-center">
      <i className={`ti ${icon} text-[28px] text-slate-400`} aria-hidden="true" />
      <div className="mt-2 text-[15px] font-semibold text-[#0A1A40]">{title}</div>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">{message}</p>
    </div>
  );
}
