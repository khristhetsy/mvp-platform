/**
 * Founder emails for Premium by wire: the invoice, the reminder, the receipt
 * and the pause notice. Pure: every value arrives loaded, so tests render the
 * same output production sends. No dashes as sentence punctuation in the copy.
 */
import { button, escapeHtml, shell } from "@/lib/activity/email-templates";
import {
  WIRE_COPY, WIRE_CYCLE_LABEL, wireDatePT, wireInstructionRows, wireMoney,
  type WireCycle, type WireInstructions,
} from "@/lib/billing/wire-core";

export type WireEmailInvoice = {
  invoice_number: string;
  billing_cycle: WireCycle;
  amount_cents: number;
  issued_at: string;
  due_at: string;
  period_start: string | null;
  period_end: string | null;
  received_at?: string | null;
};

export type RenderedWireEmail = { subject: string; html: string; text: string };

const FONT = "Helvetica, Arial, sans-serif";
const MUTED = "#64748B";
const LINE = "#E2E8F0";

function rowsTable(rows: Array<{ label: string; value: string }>): string {
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:6px 0 14px;">${rows
    .map((r) => `<tr><td style="padding:6px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:13px;">${escapeHtml(r.label)}</td><td style="padding:6px 0;border-bottom:1px solid ${LINE};text-align:right;font-size:13px;font-family:${FONT};">${escapeHtml(r.value)}</td></tr>`)
    .join("")}</table>`;
}

function invoiceRows(inv: WireEmailInvoice): Array<{ label: string; value: string }> {
  const rows = [
    { label: "Invoice", value: inv.invoice_number },
    { label: "Plan", value: `Premium, ${WIRE_CYCLE_LABEL[inv.billing_cycle].toLowerCase()}` },
    { label: "Amount", value: `${wireMoney(inv.amount_cents)} USD` },
    { label: "Issued", value: wireDatePT(inv.issued_at) },
    { label: "Due", value: wireDatePT(inv.due_at) },
  ];
  if (inv.period_start && inv.period_end) rows.push({ label: "Service period", value: `${wireDatePT(inv.period_start)} to ${wireDatePT(inv.period_end)}` });
  return rows;
}

function instructionsBlock(instr: WireInstructions, reference: string): { html: string; text: string } {
  const rows = [...wireInstructionRows(instr), { label: "Reference", value: reference }];
  return {
    html: `<p style="margin:14px 0 4px;font-weight:bold;">Wire instructions</p>${rowsTable(rows)}<p style="margin:0 0 14px;color:${MUTED};font-size:13px;">${escapeHtml(WIRE_COPY.reference)}</p>`,
    text: ["Wire instructions", ...rows.map((r) => `${r.label}: ${r.value}`), WIRE_COPY.reference].join("\n"),
  };
}

function frame(subject: string, preheader: string, inner: string): string {
  return shell(inner, {
    audience: "founder",
    subject,
    preheader,
    reason: "You are receiving this because you requested iCapOS Premium, paid by bank wire.",
    lines: [WIRE_COPY.disclaimer],
  });
}

export function renderWireInvoiceEmail(input: {
  firstName: string | null;
  invoice: WireEmailInvoice;
  instructions: WireInstructions;
  billingUrl: string;
  pdfUrl: string;
  isRenewal: boolean;
}): RenderedWireEmail {
  const { invoice } = input;
  const subject = input.isRenewal
    ? `Your iCapOS Premium renewal invoice ${invoice.invoice_number}`
    : `Your iCapOS Premium invoice ${invoice.invoice_number}`;
  const hello = `Hi ${input.firstName?.trim() || "there"},`;
  const lead = input.isRenewal
    ? "Your next Premium period is coming up. Here is the invoice for it."
    : "Thank you for choosing Premium. We do the heavy lifting so you can close the deal.";
  const after = input.isRenewal
    ? "Premium continues without a break once your wire is received."
    : "Premium activates as soon as your wire is received, usually within 1 to 2 business days.";
  const instr = instructionsBlock(input.instructions, invoice.invoice_number);
  const html = frame(subject, `${wireMoney(invoice.amount_cents)} due ${wireDatePT(invoice.due_at)}`, [
    `<p>${escapeHtml(hello)}</p>`,
    `<p>${escapeHtml(lead)}</p>`,
    rowsTable(invoiceRows(invoice)),
    instr.html,
    `<p>${escapeHtml(after)}</p>`,
    `<p>${button("Download PDF", input.pdfUrl, true)}${button("View billing", input.billingUrl, false)}</p>`,
    `<p style="color:${MUTED};font-size:13px;">${escapeHtml(WIRE_COPY.flatFee)}</p>`,
  ].join(""));
  const text = [
    hello,
    "",
    lead,
    "",
    ...invoiceRows(invoice).map((r) => `${r.label}: ${r.value}`),
    "",
    instr.text,
    "",
    after,
    `Download PDF: ${input.pdfUrl}`,
    `Billing: ${input.billingUrl}`,
    "",
    WIRE_COPY.flatFee,
    WIRE_COPY.disclaimer,
  ].join("\n");
  return { subject, html, text };
}

export function renderWireReminderEmail(input: {
  firstName: string | null;
  invoice: WireEmailInvoice;
  instructions: WireInstructions;
  billingUrl: string;
  pdfUrl: string;
  overdueDays: number;
}): RenderedWireEmail {
  const { invoice } = input;
  const subject = `Reminder: iCapOS Premium invoice ${invoice.invoice_number}`;
  const hello = `Hi ${input.firstName?.trim() || "there"},`;
  const lead = input.overdueDays > 0
    ? `A quick reminder: invoice ${invoice.invoice_number} was due on ${wireDatePT(invoice.due_at)}. If your wire is already on its way, thank you, and you can ignore this note.`
    : `A quick reminder: invoice ${invoice.invoice_number} is due on ${wireDatePT(invoice.due_at)}.`;
  const instr = instructionsBlock(input.instructions, invoice.invoice_number);
  const html = frame(subject, `${wireMoney(invoice.amount_cents)}, reference ${invoice.invoice_number}`, [
    `<p>${escapeHtml(hello)}</p>`,
    `<p>${escapeHtml(lead)}</p>`,
    rowsTable(invoiceRows(invoice)),
    instr.html,
    `<p>${button("Download PDF", input.pdfUrl, true)}${button("View billing", input.billingUrl, false)}</p>`,
  ].join(""));
  const text = [hello, "", lead, "", ...invoiceRows(invoice).map((r) => `${r.label}: ${r.value}`), "", instr.text, "", `Download PDF: ${input.pdfUrl}`, "", WIRE_COPY.disclaimer].join("\n");
  return { subject, html, text };
}

export function renderWireReceiptEmail(input: {
  firstName: string | null;
  invoice: WireEmailInvoice;
  periodStart: string;
  periodEnd: string;
  dashboardUrl: string;
  pdfUrl: string;
}): RenderedWireEmail {
  const { invoice } = input;
  const subject = `Payment received: iCapOS Premium invoice ${invoice.invoice_number}`;
  const hello = `Hi ${input.firstName?.trim() || "there"},`;
  const lead = `We received your wire of ${wireMoney(invoice.amount_cents)} for invoice ${invoice.invoice_number}. Premium is active from ${wireDatePT(input.periodStart)} to ${wireDatePT(input.periodEnd)}.`;
  const next = "We send your next invoice 7 days before this period ends.";
  const rows = [
    { label: "Invoice", value: invoice.invoice_number },
    { label: "Amount received", value: `${wireMoney(invoice.amount_cents)} USD` },
    { label: "Received", value: wireDatePT(invoice.received_at ?? new Date().toISOString()) },
    { label: "Premium active", value: `${wireDatePT(input.periodStart)} to ${wireDatePT(input.periodEnd)}` },
  ];
  const html = frame(subject, `Premium is active until ${wireDatePT(input.periodEnd)}`, [
    `<p>${escapeHtml(hello)}</p>`,
    `<p>${escapeHtml(lead)}</p>`,
    rowsTable(rows),
    `<p>${escapeHtml(next)}</p>`,
    `<p>${button("Open iCapOS", input.dashboardUrl, true)}${button("Download receipt PDF", input.pdfUrl, false)}</p>`,
    `<p style="color:${MUTED};font-size:13px;">${escapeHtml(WIRE_COPY.flatFee)}</p>`,
  ].join(""));
  const text = [hello, "", lead, "", ...rows.map((r) => `${r.label}: ${r.value}`), "", next, `Open iCapOS: ${input.dashboardUrl}`, "", WIRE_COPY.flatFee, WIRE_COPY.disclaimer].join("\n");
  return { subject, html, text };
}

export function renderWirePausedEmail(input: {
  firstName: string | null;
  invoice: WireEmailInvoice;
  billingUrl: string;
}): RenderedWireEmail {
  const { invoice } = input;
  const subject = `Premium services paused: invoice ${invoice.invoice_number} is overdue`;
  const hello = `Hi ${input.firstName?.trim() || "there"},`;
  const lead = `Invoice ${invoice.invoice_number} for ${wireMoney(invoice.amount_cents)} was due on ${wireDatePT(invoice.due_at)} and we have not received the wire, so Premium services are paused.`;
  const next = "Your account, documents and reports stay as they are. Premium resumes as soon as your wire is received.";
  const html = frame(subject, "Premium resumes as soon as your wire is received", [
    `<p>${escapeHtml(hello)}</p>`,
    `<p>${escapeHtml(lead)}</p>`,
    `<p>${escapeHtml(next)}</p>`,
    `<p>${button("View invoice and wire instructions", input.billingUrl, true)}</p>`,
  ].join(""));
  const text = [hello, "", lead, "", next, `Billing: ${input.billingUrl}`, "", WIRE_COPY.disclaimer].join("\n");
  return { subject, html, text };
}
