/**
 * Accounting emails to customers: the invoice (with the payment schedule for a
 * monthly series) and the payment receipt. Pure, so tests render exactly what
 * production sends. No dashes as sentence punctuation in the copy.
 */
import { button, escapeHtml, shell } from "@/lib/activity/email-templates";
import { wireInstructionRows, type WireInstructions } from "@/lib/billing/wire-core";
import {
  ACCOUNTING_COPY, balanceDue, entityName, fmtDate, money, type Customer, type Invoice, type InvoiceLine,
} from "@/lib/accounting/core";
import type { SeriesRow } from "@/lib/accounting/invoice-pdf";

export type RenderedEmail = { subject: string; html: string; text: string };

const MUTED = "#64748B";
const LINE = "#E2E8F0";

function table(rows: Array<{ label: string; value: string }>): string {
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:6px 0 14px;">${rows
    .map((r) => `<tr><td style="padding:6px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:13px;">${escapeHtml(r.label)}</td><td style="padding:6px 0;border-bottom:1px solid ${LINE};text-align:right;font-size:13px;">${escapeHtml(r.value)}</td></tr>`)
    .join("")}</table>`;
}

function firstName(c: Customer): string {
  return c.contact_name?.trim().split(/\s+/)[0] || "there";
}

export function renderInvoiceEmail(input: {
  invoice: Invoice;
  lines: InvoiceLine[];
  customer: Customer;
  instructions: WireInstructions;
  pdfUrl: string;
  /** The customer's pay page (bank details with copy buttons). Omitted for a paid invoice. */
  payUrl?: string | null;
  series?: SeriesRow[];
  reminder?: boolean;
}): RenderedEmail {
  const { invoice, customer } = input;
  const from = entityName(invoice.entity);
  const due = balanceDue(invoice);
  const subject = input.reminder
    ? `Reminder: invoice ${invoice.invoice_number} from ${from}, ${money(due)} due ${fmtDate(invoice.due_date)}`
    : `Invoice ${invoice.invoice_number} from ${from}, ${money(due)} due ${fmtDate(invoice.due_date)}`;
  const hello = `Hi ${firstName(customer)},`;
  const lead = input.reminder
    ? `This is a friendly reminder that invoice ${invoice.invoice_number} is due ${fmtDate(invoice.due_date)}.`
    : `Here is invoice ${invoice.invoice_number} from ${from}. The PDF is attached.`;

  const lineRows = input.lines.map((l) => ({ label: l.description, value: money(l.amount_cents, invoice.currency) }));
  const summary = [
    ...lineRows,
    ...(invoice.amount_paid_cents > 0 ? [{ label: "Paid", value: `-${money(invoice.amount_paid_cents, invoice.currency)}` }] : []),
    { label: "Balance due", value: money(due, invoice.currency) },
    { label: "Due date", value: fmtDate(invoice.due_date) },
  ];
  const schedule = input.series && input.series.length > 1
    ? input.series.map((s) => ({ label: `${s.invoice_number} · ${fmtDate(s.issue_date)}`, value: `${money(s.total_cents, invoice.currency)} due ${fmtDate(s.due_date)}` }))
    : [];
  const pay = [...wireInstructionRows(input.instructions), { label: "Reference", value: invoice.invoice_number }];
  const payKnown = pay.length > 2;

  const html = shell([
    `<p>${escapeHtml(hello)}</p>`,
    `<p>${escapeHtml(lead)}</p>`,
    table(summary),
    schedule.length
      ? `<p style="margin:14px 0 4px;font-weight:bold;">Payment schedule</p><p style="margin:0;color:${MUTED};font-size:13px;">Each invoice is emailed on its date.</p>${table(schedule)}`
      : "",
    `<p style="margin:14px 0 4px;font-weight:bold;">How to pay</p>`,
    payKnown ? table(pay) : `<p style="color:${MUTED};">${escapeHtml(ACCOUNTING_COPY.noInstructions)}</p>`,
    `<p style="color:${MUTED};font-size:13px;">${escapeHtml(ACCOUNTING_COPY.payNote)}</p>`,
    `<p>${input.payUrl ? button("Pay invoice", input.payUrl, true) : ""}${button("Download invoice", input.pdfUrl, !input.payUrl)}</p>`,
    `<p>${escapeHtml(ACCOUNTING_COPY.footer)}</p>`,
  ].join(""), {
    audience: "shared",
    subject,
    preheader: `${money(due)} due ${fmtDate(invoice.due_date)}`,
    reason: `You are receiving this because ${from} sent you an invoice.`,
    lines: [ACCOUNTING_COPY.disclaimer],
  });

  const text = [
    hello, "", lead, "",
    ...summary.map((r) => `${r.label}: ${r.value}`),
    ...(schedule.length ? ["", "Payment schedule (each invoice is emailed on its date)", ...schedule.map((r) => `${r.label}: ${r.value}`)] : []),
    "", "How to pay",
    ...(payKnown ? pay.map((r) => `${r.label}: ${r.value}`) : [ACCOUNTING_COPY.noInstructions]),
    ACCOUNTING_COPY.payNote, "",
    ...(input.payUrl ? [`Pay invoice: ${input.payUrl}`] : []),
    `Download invoice: ${input.pdfUrl}`, "",
    ACCOUNTING_COPY.footer, ACCOUNTING_COPY.disclaimer,
  ].join("\n");
  return { subject, html, text };
}

export function renderReceiptEmail(input: { invoice: Invoice; customer: Customer; amountCents: number; paidOn: string; pdfUrl: string }): RenderedEmail {
  const { invoice, customer } = input;
  const from = entityName(invoice.entity);
  const subject = `Payment received for invoice ${invoice.invoice_number}`;
  const rows = [
    { label: "Invoice", value: invoice.invoice_number },
    { label: "Payment", value: money(input.amountCents, invoice.currency) },
    { label: "Received", value: fmtDate(input.paidOn) },
    { label: "Balance", value: money(balanceDue(invoice), invoice.currency) },
  ];
  const hello = `Hi ${firstName(customer)},`;
  const lead = `Thank you. We received your payment for invoice ${invoice.invoice_number}.`;
  const html = shell([
    `<p>${escapeHtml(hello)}</p>`,
    `<p>${escapeHtml(lead)}</p>`,
    table(rows),
    `<p>${button("Download receipt", input.pdfUrl, true)}</p>`,
  ].join(""), {
    audience: "shared",
    subject,
    preheader: `${money(input.amountCents)} received`,
    reason: `You are receiving this because you paid an invoice from ${from}.`,
    lines: [ACCOUNTING_COPY.disclaimer],
  });
  const text = [hello, "", lead, "", ...rows.map((r) => `${r.label}: ${r.value}`), "", `Download receipt: ${input.pdfUrl}`, "", ACCOUNTING_COPY.disclaimer].join("\n");
  return { subject, html, text };
}
