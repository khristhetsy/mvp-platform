"use client";

import { useState } from "react";
import {
  WIRE_COPY, WIRE_CYCLE_LABEL, WIRE_STATUS_LABEL, WIRE_STATUS_TONE, wireDatePT, wireInstructionRows,
  wireInstructionsComplete, wireMoney, type WireCycle, type WireInstructions, type WireInvoiceRow, type WireStatus,
} from "@/lib/billing/wire-core";

/**
 * Premium checkout by bank wire (Oct 9, 2026). Premium never goes through Lemon
 * Squeezy: the founder picks monthly or quarterly, requests an invoice
 * (POST /api/billing/wire-invoice), and sees it here with the wire
 * instructions. Staff mark the wire received in Admin, Billing, Wire payments.
 */
export function WireStatusPill({ status }: Readonly<{ status: WireStatus }>) {
  const tone = WIRE_STATUS_TONE[status];
  return (
    <span style={{ background: tone.bg, color: tone.fg }} className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold">
      {WIRE_STATUS_LABEL[status]}
    </span>
  );
}

export function WireInvoiceView({ invoice, instructions }: Readonly<{ invoice: WireInvoiceRow; instructions: WireInstructions }>) {
  const rows = wireInstructionRows(instructions);
  const ready = wireInstructionsComplete(instructions);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Invoice</p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-[#0A1A40]">{invoice.invoice_number}</p>
        </div>
        <div className="flex items-center gap-3">
          <WireStatusPill status={invoice.status} />
          <a
            href={`/api/billing/wire-invoice/${invoice.id}/pdf?download=1`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#0A1A40] hover:bg-slate-50"
          >
            Download PDF
          </a>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-slate-500">Amount</dt><dd className="font-semibold text-[#0A1A40]">{wireMoney(invoice.amount_cents)} USD</dd></div>
        <div><dt className="text-xs text-slate-500">Billing cycle</dt><dd className="text-slate-800">{WIRE_CYCLE_LABEL[invoice.billing_cycle]}</dd></div>
        <div><dt className="text-xs text-slate-500">Issued</dt><dd className="text-slate-800">{wireDatePT(invoice.issued_at)}</dd></div>
        <div><dt className="text-xs text-slate-500">Due</dt><dd className="text-slate-800">{wireDatePT(invoice.due_at)}</dd></div>
      </dl>

      {invoice.status === "received" ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Wire received {wireDatePT(invoice.received_at)}. Premium is active.
        </p>
      ) : invoice.status === "void" ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">This invoice is void.</p>
      ) : (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-[#0A1A40]">Wire instructions</p>
          {ready ? (
            <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[180px_1fr]">
              {rows.map((r) => (
                <div key={r.label} className="contents">
                  <dt className="text-slate-500">{r.label}</dt>
                  <dd className="font-mono text-slate-900">{r.value}</dd>
                </div>
              ))}
              <dt className="text-slate-500">Reference</dt>
              <dd className="font-mono font-semibold text-[#1A6CE4]">{invoice.invoice_number}</dd>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Our team will email the bank details for this invoice. Use <span className="font-mono font-semibold">{invoice.invoice_number}</span> as the reference.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-600">{WIRE_COPY.reference}</p>
        </div>
      )}
    </div>
  );
}

export function WireCheckoutPanel({
  monthlyLabel,
  quarterlyLabel,
  instructions,
  openInvoice = null,
}: Readonly<{
  /** "$1,000", from the pricing catalogue. */
  monthlyLabel: string;
  /** "$3,000", three months, no discount. */
  quarterlyLabel: string;
  instructions: WireInstructions;
  /** An invoice already awaiting payment, shown instead of the request form. */
  openInvoice?: WireInvoiceRow | null;
}>) {
  const [cycle, setCycle] = useState<WireCycle>(openInvoice?.billing_cycle ?? "monthly");
  const [invoice, setInvoice] = useState<WireInvoiceRow | null>(openInvoice);
  const [instr, setInstr] = useState<WireInstructions>(instructions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  async function request() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/wire-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle }),
      });
      const data = (await res.json().catch(() => null)) as { invoice?: WireInvoiceRow; instructions?: WireInstructions; emailed?: boolean; reused?: boolean; error?: string } | null;
      if (!res.ok || !data?.invoice) {
        setError(data?.error ?? "We could not create your invoice. Please try again.");
        return;
      }
      setInvoice(data.invoice);
      if (data.instructions) setInstr(data.instructions);
      setChanging(false);
      setNotice(
        data.reused
          ? "You already have this invoice open. Here it is."
          : data.emailed
            ? "Invoice created. We also emailed it to you with the wire instructions."
            : "Invoice created. Download the PDF below; our team will also send it by email.",
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const showForm = !invoice || changing || invoice.status === "void" || invoice.status === "received";

  return (
    <section className="rounded-2xl border border-[#1A6CE4]/30 bg-[#F5F8FE] p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1A6CE4]">Premium</p>
      <h3 className="mt-1 text-lg font-semibold text-[#0A1A40]">
        Premium, {monthlyLabel}/mo. We do the heavy lifting so you can close the deal.
      </h3>

      {showForm ? (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Payment method</p>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0A1A40]">
              <i className="ti ti-building-bank text-[#1A6CE4]" aria-hidden="true" />
              {WIRE_COPY.paymentMethod}
              <span className="ml-auto text-[11px] text-slate-500">Premium only</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Billing cycle</p>
            <div role="radiogroup" aria-label="Billing cycle" className="mt-1.5 grid grid-cols-2 gap-2">
              {(["monthly", "quarterly"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={cycle === c}
                  onClick={() => setCycle(c)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${cycle === c ? "border-2 border-[#1A6CE4] bg-white" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <span className="block font-semibold text-[#0A1A40]">{WIRE_CYCLE_LABEL[c]}</span>
                  <span className="block text-xs text-slate-600">{c === "monthly" ? monthlyLabel : quarterlyLabel}{c === "quarterly" ? " every 3 months" : " a month"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void request()}
                disabled={busy}
                className="rounded-lg bg-[#1A6CE4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-60"
              >
                {busy ? "Creating invoice…" : "Request wire invoice"}
              </button>
              {changing ? (
                <button type="button" onClick={() => setChanging(false)} className="text-sm font-medium text-slate-600 hover:underline">Cancel</button>
              ) : null}
            </div>
            {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
          </div>
        </div>
      ) : null}

      {invoice && !showForm ? (
        <div className="mt-5 space-y-3">
          {notice ? <p className="text-sm text-[#0A1A40]">{notice}</p> : null}
          <WireInvoiceView invoice={invoice} instructions={instr} />
          {invoice.status === "awaiting" || invoice.status === "overdue" ? (
            <button type="button" onClick={() => { setCycle(invoice.billing_cycle === "monthly" ? "quarterly" : "monthly"); setChanging(true); }} className="text-xs font-medium text-[#1A6CE4] hover:underline">
              Switch to {invoice.billing_cycle === "monthly" ? "quarterly" : "monthly"} billing
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 space-y-1 text-xs leading-5 text-slate-600">
        <p>{WIRE_COPY.emailNote}</p>
        <p>{WIRE_COPY.flatFee}</p>
        <p className="text-slate-500">{WIRE_COPY.disclaimer}</p>
      </div>
    </section>
  );
}

/** A plan button (next to the Lemon Squeezy ones) that opens the wire panel in a dialog. */
export function PremiumWireButton({
  label,
  ...panel
}: Readonly<{ label: string } & Parameters<typeof WireCheckoutPanel>[0]>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[#e2e6ed] px-5 py-2 text-[13px] font-medium text-[#0c2340] hover:bg-slate-50"
      >
        {label}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Premium by bank wire"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[rgba(12,35,64,0.45)] p-4 sm:items-center sm:p-6"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 z-10 text-slate-400 hover:text-slate-600">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
            <WireCheckoutPanel {...panel} />
          </div>
        </div>
      ) : null}
    </>
  );
}

/** The founder's wire invoices with their status (billing pages). */
export function WireInvoiceList({ invoices }: Readonly<{ invoices: WireInvoiceRow[] }>) {
  if (!invoices.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Invoice</th>
            <th className="px-4 py-2.5 font-medium">Cycle</th>
            <th className="px-4 py-2.5 font-medium">Amount</th>
            <th className="px-4 py-2.5 font-medium">Issued</th>
            <th className="px-4 py-2.5 font-medium">Due</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium"><span className="sr-only">PDF</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-2.5 font-mono text-[#0A1A40]">{inv.invoice_number}</td>
              <td className="px-4 py-2.5 text-slate-700">{WIRE_CYCLE_LABEL[inv.billing_cycle]}</td>
              <td className="px-4 py-2.5 text-slate-700">{wireMoney(inv.amount_cents)}</td>
              <td className="px-4 py-2.5 text-slate-700">{wireDatePT(inv.issued_at)}</td>
              <td className="px-4 py-2.5 text-slate-700">{wireDatePT(inv.due_at)}</td>
              <td className="px-4 py-2.5"><WireStatusPill status={inv.status} /></td>
              <td className="px-4 py-2.5 text-right">
                <a href={`/api/billing/wire-invoice/${inv.id}/pdf?download=1`} className="text-xs font-semibold text-[#1A6CE4] hover:underline">PDF</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
