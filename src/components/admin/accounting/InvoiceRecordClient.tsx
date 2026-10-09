"use client";

/** Accounting › Invoices › one invoice: the document, its actions, payments, bank match and series. */
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OdooPager } from "@/components/admin/OdooPager";
import {
  PAYMENT_METHODS, balanceDue, displayStatus, entityName, ENTITY_ADDRESS, fmtDate, fmtStampPT, money, todayPT,
  type BankTransaction, type Customer, type Invoice, type InvoiceLine, type Payment,
} from "@/lib/accounting/core";
import { ErrorLine, Field, Modal, Section, StatusTag, api, btnCls, dangerCls, inputCls, primaryCls } from "@/components/admin/accounting/ui";

type SeriesItem = Pick<Invoice, "id" | "invoice_number" | "issue_date" | "due_date" | "total_cents" | "amount_paid_cents" | "status" | "series_index">;

export function InvoiceRecordClient({
  invoice, lines, customer, payments, series, bankCandidates, prevId, nextId, position, total, emailError,
}: Readonly<{
  invoice: Invoice;
  lines: InvoiceLine[];
  customer: Customer | null;
  payments: Payment[];
  series: SeriesItem[];
  bankCandidates: BankTransaction[];
  prevId: string | null;
  nextId: string | null;
  position: number;
  total: number;
  emailError: string | null;
}>) {
  const router = useRouter();
  const status = displayStatus(invoice, todayPT());
  const due = balanceDue(invoice);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(emailError ? `The invoice was created, but the email failed: ${emailError}` : null);
  const [error, setError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState<null | "send" | "remind">(null);
  const [to, setTo] = useState(customer?.email ?? "");
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: (due / 100).toFixed(2), paid_on: todayPT(), method: "ach", reference: "", send_receipt: false });

  async function act(key: string, run: () => Promise<{ ok: boolean; error?: string }>, done?: string) {
    setBusy(key);
    setError(null);
    const r = await run();
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "Something went wrong."); return false; }
    if (done) setNotice(done);
    router.refresh();
    return true;
  }

  const send = (kind: "send" | "remind") =>
    act(kind, async () => {
      const r = await api(`/api/admin/accounting/invoices/${invoice.id}`, "POST", { action: kind, to });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, kind === "remind" ? `Reminder sent to ${to}.` : `Invoice sent to ${to}.`).then((ok) => { if (ok) setSendOpen(null); });

  const recordPayment = () =>
    act("pay", async () => {
      const r = await api(`/api/admin/accounting/invoices/${invoice.id}`, "POST", { action: "payment", ...pay });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, "Payment recorded.").then((ok) => { if (ok) setPayOpen(false); });

  const matchDeposit = (txId: string) =>
    act(`match-${txId}`, async () => {
      const r = await api(`/api/admin/accounting/bank/transactions/${txId}`, "POST", { action: "match", invoice_id: invoice.id });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, "Deposit matched. The invoice is updated.");

  const removePayment = (id: string) =>
    act(`rm-${id}`, async () => {
      const r = await api(`/api/admin/accounting/payments/${id}`, "DELETE");
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, "Payment removed.");

  const voidIt = () =>
    act("void", async () => {
      const r = await api(`/api/admin/accounting/invoices/${invoice.id}`, "POST", { action: "void" });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, "Invoice voided.");

  async function deleteIt() {
    setBusy("delete");
    const r = await api(`/api/admin/accounting/invoices/${invoice.id}`, "DELETE");
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    router.push("/admin/accounting/invoices");
    router.refresh();
  }

  const editable = invoice.status === "draft" || invoice.status === "scheduled";
  const canPay = invoice.status === "sent" && due > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/accounting/invoices" className="text-[13px] text-[#1A6CE4]">Invoices</Link>
        <span className="text-slate-400">/</span>
        <h1 className="text-[15px] font-semibold text-slate-900">{invoice.invoice_number}</h1>
        <StatusTag status={status} />
        <OdooPager
          className="ml-auto"
          label={`${position} / ${total}`}
          prev={{ onClick: prevId ? () => router.push(`/admin/accounting/invoices/${prevId}`) : undefined, disabled: !prevId }}
          next={{ onClick: nextId ? () => router.push(`/admin/accounting/invoices/${nextId}`) : undefined, disabled: !nextId }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {invoice.status !== "void" && invoice.status !== "paid" ? (
          editable
            ? <button type="button" className={primaryCls} disabled={busy !== null} onClick={() => setSendOpen("send")}><i className="ti ti-send" aria-hidden="true" />Send invoice</button>
            : <button type="button" className={btnCls} disabled={busy !== null} onClick={() => setSendOpen("remind")}><i className="ti ti-bell" aria-hidden="true" />Send reminder</button>
        ) : null}
        {canPay ? <button type="button" className={primaryCls} disabled={busy !== null} onClick={() => setPayOpen(true)}><i className="ti ti-cash" aria-hidden="true" />Record payment</button> : null}
        <a href={`/api/admin/accounting/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer" className={btnCls}><i className="ti ti-file-type-pdf" aria-hidden="true" />View PDF</a>
        <a href={`/api/admin/accounting/invoices/${invoice.id}/pdf?download=1`} className={btnCls}><i className="ti ti-download" aria-hidden="true" />Download</a>
        {editable ? <Link href={`/admin/accounting/invoices/${invoice.id}/edit`} className={btnCls}><i className="ti ti-edit" aria-hidden="true" />Edit</Link> : null}
        {editable ? <button type="button" className={dangerCls} disabled={busy !== null} onClick={deleteIt}><i className="ti ti-trash" aria-hidden="true" />Delete</button> : null}
        {invoice.status === "sent" && invoice.amount_paid_cents === 0 ? <button type="button" className={dangerCls} disabled={busy !== null} onClick={voidIt}><i className="ti ti-ban" aria-hidden="true" />Void</button> : null}
      </div>
      {notice ? <p className="rounded-lg bg-[#EAF3DE] px-3 py-2 text-[12.5px] text-[#27500A]">{notice}</p> : null}
      <ErrorLine text={error} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-[13px]">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold text-[#0A1A40]">{entityName(invoice.entity)}</div>
              <div className="text-slate-500">{ENTITY_ADDRESS}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1A6CE4]">{invoice.status === "paid" ? "Receipt" : "Invoice"}</div>
              <div className="text-[17px] font-semibold text-[#0A1A40]">{invoice.invoice_number}</div>
              <div className="text-slate-500">Issued {fmtDate(invoice.issue_date)} · due {fmtDate(invoice.due_date)}</div>
            </div>
          </div>
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bill to</div>
          <div className="text-slate-800">
            {customer ? [customer.contact_name, customer.company].filter(Boolean).join(", ") : "Unknown customer"}
            {customer?.email ? <div className="text-slate-500">{customer.email}</div> : null}
            {customer?.address ? <div className="whitespace-pre-line text-slate-500">{customer.address}</div> : null}
          </div>
          <table className="mt-4 w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] text-slate-500">
                <th className="py-1.5">Description</th><th className="py-1.5 text-right">Qty</th><th className="py-1.5 text-right">Price</th><th className="py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id ?? l.position} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-800">{l.description}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(l.unit_cents)}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(l.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto mt-2 w-60 space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="tabular-nums">{money(invoice.total_cents)}</span></div>
            {invoice.amount_paid_cents > 0 ? <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="tabular-nums">-{money(invoice.amount_paid_cents)}</span></div> : null}
            <div className="flex justify-between font-semibold text-[#0A1A40]"><span>Balance due</span><span className="tabular-nums">{money(due)}</span></div>
          </div>
          {invoice.memo ? <p className="mt-4 whitespace-pre-line text-slate-600">{invoice.memo}</p> : null}
          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px]">
            <div className="font-medium text-slate-800">Pay by bank transfer</div>
            <div className="text-slate-500">ACH or wire with reference {invoice.invoice_number}. Bank details print from <Link href="/admin/accounting/settings" className="text-[#1A6CE4]">Settings</Link>.</div>
          </div>
        </div>

        <div className="space-y-3">
          {canPay ? (
            <Section title="Bank match" icon="ti-building-bank">
              {bankCandidates.length === 0 ? (
                <p className="px-4 py-3 text-[12.5px] text-slate-500">No deposit of {money(due)} waiting in Bank yet. New Bank of America transactions arrive daily.</p>
              ) : bankCandidates.map((t) => (
                <div key={t.id} className="border-t border-slate-100 px-4 py-2.5 text-[12.5px] first:border-t-0">
                  <div className="text-slate-800">Deposit {fmtDate(t.posted_on)} · {money(Number(t.amount_cents))}</div>
                  <div className="truncate text-slate-500">{t.description}</div>
                  <button type="button" className={`${btnCls} mt-2 w-full justify-center`} disabled={busy !== null} onClick={() => matchDeposit(t.id)}><i className="ti ti-check" aria-hidden="true" />Match and record payment</button>
                </div>
              ))}
            </Section>
          ) : null}

          <Section title="Payments" icon="ti-cash">
            {payments.length === 0 ? <p className="px-4 py-3 text-[12.5px] text-slate-500">No payments recorded.</p> : payments.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-[12.5px] first:border-t-0">
                <div className="min-w-0 flex-1">
                  <div className="text-slate-800">{money(p.amount_cents)} · {PAYMENT_METHODS.find((m) => m.id === p.method)?.label ?? p.method}</div>
                  <div className="truncate text-slate-500">{fmtDate(p.paid_on)}{p.reference ? ` · ${p.reference}` : ""}{p.bank_transaction_id ? " · from Bank" : ""}</div>
                </div>
                <button type="button" aria-label="Remove payment" className="text-slate-400 hover:text-red-600" disabled={busy !== null} onClick={() => removePayment(p.id)}><i className="ti ti-trash" aria-hidden="true" /></button>
              </div>
            ))}
          </Section>

          {series.length > 1 ? (
            <Section title={`Monthly series · ${series.length} invoices`} icon="ti-repeat">
              {series.map((s) => (
                <Link key={s.id} href={`/admin/accounting/invoices/${s.id}`} className={`flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-[12.5px] first:border-t-0 hover:bg-slate-50 ${s.id === invoice.id ? "bg-slate-50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-800">{s.series_index}. {s.invoice_number}</div>
                    <div className="text-slate-500">{fmtDate(s.issue_date)} · {money(s.total_cents)}</div>
                  </div>
                  <StatusTag status={displayStatus(s, todayPT())} />
                </Link>
              ))}
              <p className="border-t border-slate-100 px-4 py-2 text-[11.5px] text-slate-500">Scheduled invoices email themselves on their date, about 6 AM PT.</p>
            </Section>
          ) : null}

          <Section title="Activity" icon="ti-history">
            <div className="space-y-1 px-4 py-3 text-[12px] text-slate-600">
              <div>Created {fmtStampPT(invoice.created_at)}</div>
              {invoice.sent_at ? <div>Sent {fmtStampPT(invoice.sent_at)}{invoice.last_emailed_to ? ` to ${invoice.last_emailed_to}` : ""}</div> : <div>Not sent yet{invoice.status === "scheduled" ? `, sends ${fmtDate(invoice.issue_date)}` : ""}</div>}
              {invoice.paid_at ? <div>Paid {fmtDate(invoice.paid_at.slice(0, 10))}</div> : null}
              {invoice.voided_at ? <div>Voided {fmtStampPT(invoice.voided_at)}</div> : null}
            </div>
          </Section>
        </div>
      </div>

      {sendOpen ? (
        <Modal
          title={sendOpen === "remind" ? "Send a reminder" : "Send invoice"}
          onClose={() => setSendOpen(null)}
          footer={<><button type="button" className={btnCls} onClick={() => setSendOpen(null)}>Cancel</button><button type="button" className={primaryCls} disabled={busy !== null || !to.trim()} onClick={() => send(sendOpen)}>{busy ? "Sending…" : "Send"}</button></>}
        >
          <Field label="To" hint="The PDF is attached, with your bank transfer details."><input className={inputCls} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com" /></Field>
          {series.length > 1 && invoice.series_index === 1 && sendOpen === "send" ? <p className="text-[12px] text-slate-500">This email also lists the full payment schedule of {series.length} invoices.</p> : null}
          <ErrorLine text={error} />
        </Modal>
      ) : null}

      {payOpen ? (
        <Modal
          title="Record payment"
          onClose={() => setPayOpen(false)}
          footer={<><button type="button" className={btnCls} onClick={() => setPayOpen(false)}>Cancel</button><button type="button" className={primaryCls} disabled={busy !== null} onClick={recordPayment}>{busy ? "Saving…" : "Record payment"}</button></>}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount"><input className={`${inputCls} text-right`} inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
            <Field label="Received on"><input className={inputCls} type="date" value={pay.paid_on} onChange={(e) => setPay({ ...pay, paid_on: e.target.value })} /></Field>
            <Field label="Method">
              <select className={inputCls} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Reference"><input className={inputCls} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="Bank confirmation" /></Field>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-slate-600"><input type="checkbox" checked={pay.send_receipt} onChange={(e) => setPay({ ...pay, send_receipt: e.target.checked })} /> Email a receipt to {customer?.email ?? "the customer"}</label>
          <ErrorLine text={error} />
        </Modal>
      ) : null}
    </div>
  );
}
