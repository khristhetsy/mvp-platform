/**
 * Accounting app: server side (service role). Approved Oct 9, 2026.
 *
 * Invoices go out by email with a PDF; customers pay by bank transfer with the
 * invoice number as the reference. Bank of America transactions arrive daily
 * through Plaid (read only) or from a CSV / QFX download, and staff confirm
 * which deposit paid which invoice. No money moves through iCapOS.
 *
 * Pure helpers: core.ts (tested). PDF: invoice-pdf.ts. Emails: emails.ts.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { notifyStaff } from "@/lib/notifications/notifications";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { EMPTY_WIRE_INSTRUCTIONS, normalizeWireInstructions, type WireInstructions } from "@/lib/billing/wire-core";
import { getWireInstructions, saveWireInstructions } from "@/lib/billing/wire";
import {
  DEFAULT_ENTITY, addDays, balanceDue, displayStatus, invoiceTotal, isEntity, isIsoDate, isPaymentMethod,
  autoMatch, lineAmount, money, parseBankFile, payPagePath, plaidAmountToCents, seriesDates, seriesLineLabel, suggestMatch, todayPT,
  type BankTransaction, type Customer, type EntityId, type Invoice, type InvoiceLine, type MatchCandidate,
  type Payment, type PaymentMethod,
} from "@/lib/accounting/core";
import { renderInvoicePdf, type SeriesRow } from "@/lib/accounting/invoice-pdf";
import { renderInvoiceEmail, renderReceiptEmail } from "@/lib/accounting/emails";
import * as plaid from "@/lib/accounting/plaid";

/* eslint-disable @typescript-eslint/no-explicit-any */
// The acct_* tables are not in the generated types yet (migration
// 20261010090000); same cast the wire invoice code uses.
type Db = any;
function db(): Db {
  return createServiceRoleClient() as Db;
}

const CUSTOMER_COLS = "id, entity, contact_name, company, email, phone, address, crm_contact_id, notes, archived, created_at";
const INVOICE_COLS =
  "id, entity, invoice_number, customer_id, status, issue_date, due_date, currency, total_cents, amount_paid_cents, memo, series_id, series_index, series_count, public_token, sent_at, last_emailed_to, paid_at, voided_at, created_at";
const LINE_COLS = "id, position, description, quantity, unit_cents, amount_cents";
const TX_COLS = "id, account_id, source, external_id, posted_on, description, merchant, amount_cents, pending, status, category, matched_invoice_id";

export function customerLabel(c: Pick<Customer, "company" | "contact_name"> | null | undefined): string {
  if (!c) return "Unknown customer";
  return [c.company, c.contact_name].filter(Boolean).join(" · ") || "Unnamed customer";
}

// ── Payment instructions (per entity) ────────────────────────────────────────
// iCFO Capital Global uses the same bank details as Premium wire invoices
// (platform_settings key wire_instructions), entered once in Admin, Billing.

function instructionsKey(entity: EntityId): string | null {
  return entity === "icfo_venture_group" ? "accounting_bank_details_icfo_venture_group" : null;
}

export async function getPaymentInstructions(entity: EntityId, client: Db = db()): Promise<WireInstructions> {
  const key = instructionsKey(entity);
  if (!key) return getWireInstructions(client);
  try {
    const { data } = await client.from("platform_settings").select("value").eq("key", key).maybeSingle();
    const v = (data as { value?: unknown } | null)?.value;
    return v ? normalizeWireInstructions(v) : { ...EMPTY_WIRE_INSTRUCTIONS, beneficiary: "iCFO Venture Group" };
  } catch {
    return { ...EMPTY_WIRE_INSTRUCTIONS, beneficiary: "iCFO Venture Group" };
  }
}

export async function savePaymentInstructions(entity: EntityId, input: unknown, staffId: string, client: Db = db()): Promise<WireInstructions> {
  const key = instructionsKey(entity);
  if (!key) return saveWireInstructions(input, staffId, client);
  const clean = normalizeWireInstructions(input);
  const { error } = await client.from("platform_settings").upsert({ key, value: clean, updated_by: staffId, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Could not save bank details: ${error.message}`);
  return clean;
}

// ── Customers ────────────────────────────────────────────────────────────────

export async function listCustomers(opts: { includeArchived?: boolean } = {}, client: Db = db()): Promise<Customer[]> {
  let q = client.from("acct_customers").select(CUSTOMER_COLS).order("company", { ascending: true, nullsFirst: false }).limit(1000);
  if (!opts.includeArchived) q = q.eq("archived", false);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

export async function getCustomer(id: string, client: Db = db()): Promise<Customer | null> {
  const { data } = await client.from("acct_customers").select(CUSTOMER_COLS).eq("id", id).maybeSingle();
  return (data as Customer) ?? null;
}

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

export async function saveCustomer(input: Record<string, unknown>, staffId: string, client: Db = db()): Promise<Customer> {
  const row = {
    entity: isEntity(input.entity) ? input.entity : DEFAULT_ENTITY,
    contact_name: str(input.contact_name, 200),
    company: str(input.company, 200),
    email: str(input.email, 254),
    phone: str(input.phone, 60),
    address: str(input.address, 600),
    crm_contact_id: typeof input.crm_contact_id === "string" && input.crm_contact_id ? input.crm_contact_id : null,
    notes: str(input.notes, 2000),
    archived: input.archived === true,
    updated_at: new Date().toISOString(),
  };
  if (!row.company && !row.contact_name) throw new Error("Enter a company or a contact name.");
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error("That email address doesn't look right.");
  const id = typeof input.id === "string" ? input.id : null;
  const res = id
    ? await client.from("acct_customers").update(row).eq("id", id).select(CUSTOMER_COLS).single()
    : await client.from("acct_customers").insert({ ...row, created_by: staffId }).select(CUSTOMER_COLS).single();
  if (res.error || !res.data) throw new Error(`Could not save the customer: ${res.error?.message ?? "no row"}`);
  return res.data as Customer;
}

/** Contacts to start a customer from (shared CRM contacts). */
export async function searchCrmContacts(q: string, client: Db = db()): Promise<Array<{ id: string; name: string | null; email: string | null; company: string | null; phone: string | null }>> {
  const safe = q.replace(/[%,()]/g, " ").trim();
  if (!safe) return [];
  const { data } = await client
    .from("crm_contacts")
    .select("id, name, email, company, phone")
    .or(`name.ilike.%${safe}%,email.ilike.%${safe}%,company.ilike.%${safe}%`)
    .order("name")
    .limit(12);
  return (data ?? []) as Array<{ id: string; name: string | null; email: string | null; company: string | null; phone: string | null }>;
}

// ── Invoices: reads ──────────────────────────────────────────────────────────

export type InvoiceListRow = Invoice & { customerName: string; customerEmail: string | null };

export async function listInvoices(opts: { limit?: number } = {}, client: Db = db()): Promise<InvoiceListRow[]> {
  const { data, error } = await client.from("acct_invoices").select(INVOICE_COLS).order("issue_date", { ascending: false }).order("invoice_number", { ascending: false }).limit(opts.limit ?? 2000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Invoice[];
  const ids = [...new Set(rows.map((r) => r.customer_id))];
  const { data: cs } = ids.length ? await client.from("acct_customers").select(CUSTOMER_COLS).in("id", ids) : { data: [] };
  const byId = new Map(((cs ?? []) as Customer[]).map((c) => [c.id, c]));
  return rows.map((r) => ({ ...r, customerName: customerLabel(byId.get(r.customer_id)), customerEmail: byId.get(r.customer_id)?.email ?? null }));
}

export async function getInvoice(id: string, client: Db = db()): Promise<Invoice | null> {
  const { data } = await client.from("acct_invoices").select(INVOICE_COLS).eq("id", id).maybeSingle();
  return (data as Invoice) ?? null;
}

export async function getInvoiceLines(id: string, client: Db = db()): Promise<InvoiceLine[]> {
  const { data } = await client.from("acct_invoice_lines").select(LINE_COLS).eq("invoice_id", id).order("position");
  return ((data ?? []) as InvoiceLine[]).map((l) => ({ ...l, quantity: Number(l.quantity) }));
}

async function seriesOf(inv: Invoice, client: Db): Promise<SeriesRow[]> {
  if (!inv.series_id) return [];
  const { data } = await client.from("acct_invoices").select("invoice_number, issue_date, due_date, total_cents, status").eq("series_id", inv.series_id).order("series_index");
  return (data ?? []) as SeriesRow[];
}

export type InvoiceDetail = {
  invoice: Invoice;
  lines: InvoiceLine[];
  customer: Customer | null;
  payments: Payment[];
  series: Array<Pick<Invoice, "id" | "invoice_number" | "issue_date" | "due_date" | "total_cents" | "amount_paid_cents" | "status" | "series_index">>;
  /** Deposits waiting for review whose amount equals this invoice's balance. */
  bankCandidates: BankTransaction[];
  /** The customer's pay page, absolute. Null while the invoice is a draft, scheduled or void. */
  payUrl: string | null;
  clientReportedAt: string | null;
};

export async function getInvoiceDetail(id: string, client: Db = db()): Promise<InvoiceDetail | null> {
  const invoice = await getInvoice(id, client);
  if (!invoice) return null;
  const due = balanceDue(invoice);
  const [lines, customer, pay, series, cands] = await Promise.all([
    getInvoiceLines(id, client),
    getCustomer(invoice.customer_id, client),
    client.from("acct_payments").select("id, invoice_id, amount_cents, paid_on, method, reference, bank_transaction_id, created_at").eq("invoice_id", id).order("paid_on"),
    invoice.series_id
      ? client.from("acct_invoices").select("id, invoice_number, issue_date, due_date, total_cents, amount_paid_cents, status, series_index").eq("series_id", invoice.series_id).order("series_index")
      : Promise.resolve({ data: [] }),
    invoice.status === "sent" && due > 0
      ? client.from("acct_bank_transactions").select(TX_COLS).eq("status", "review").eq("amount_cents", due).order("posted_on", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ]);
  return {
    invoice,
    lines,
    customer,
    payments: (pay.data ?? []) as Payment[],
    series: (series.data ?? []) as InvoiceDetail["series"],
    bankCandidates: (cands.data ?? []) as BankTransaction[],
    payUrl: invoice.status === "sent" || invoice.status === "paid" ? absoluteUrl(payPagePath(invoice)) : null,
    clientReportedAt: await clientReportedAt(id, client),
  };
}

/**
 * Read separately from INVOICE_COLS so invoices keep loading if migration
 * 20261010120000 has not been run yet (the column is then simply absent).
 */
async function clientReportedAt(id: string, client: Db): Promise<string | null> {
  const { data, error } = await client.from("acct_invoices").select("client_reported_paid_at").eq("id", id).maybeSingle();
  if (error) return null;
  return ((data as { client_reported_paid_at?: string | null } | null)?.client_reported_paid_at) ?? null;
}

// ── Customer pay page (public, token in the link) ───────────────────────────

/**
 * The invoice behind a pay link, or null for a wrong token, a draft or a
 * scheduled invoice (all answer the same, so a link reveals nothing).
 */
export async function getInvoiceForPayPage(number: string, token: string, client: Db = db()): Promise<Invoice | null> {
  const num = number.trim().toUpperCase().slice(0, 40);
  if (!num || !token) return null;
  const { data } = await client.from("acct_invoices").select(INVOICE_COLS).eq("invoice_number", num).maybeSingle();
  const inv = data as Invoice | null;
  if (!inv) return null;
  const ok = token.length === inv.public_token.length && timingSafeEqual(Buffer.from(token), Buffer.from(inv.public_token));
  if (!ok || inv.status === "draft" || inv.status === "scheduled") return null;
  return { ...inv, client_reported_paid_at: await clientReportedAt(inv.id, client) };
}

export type PayPageData = {
  invoice: Invoice;
  lines: InvoiceLine[];
  customerLabel: string;
  instructions: WireInstructions;
  series: SeriesRow[];
  pdfUrl: string;
};

export async function payPageData(inv: Invoice, client: Db = db()): Promise<PayPageData> {
  const [lines, customer, instructions, series] = await Promise.all([
    getInvoiceLines(inv.id, client),
    getCustomer(inv.customer_id, client),
    getPaymentInstructions(inv.entity, client),
    seriesOf(inv, client),
  ]);
  return { invoice: inv, lines, customerLabel: customer ? customerLabel(customer) : "", instructions, series, pdfUrl: publicPdfPath(inv) };
}

/**
 * The customer pressed "I've sent the payment". Stamped once; staff get an
 * in-app alert the first time only, so pressing again changes nothing.
 */
export async function reportClientPayment(number: string, token: string, client: Db = db()): Promise<{ reportedAt: string }> {
  const inv = await getInvoiceForPayPage(number, token, client);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.status === "void") throw new Error("This invoice was cancelled.");
  if (inv.client_reported_paid_at) return { reportedAt: inv.client_reported_paid_at };
  const now = new Date().toISOString();
  const { error } = await client.from("acct_invoices").update({ client_reported_paid_at: now }).eq("id", inv.id).is("client_reported_paid_at", null);
  if (error) throw new Error("Couldn't save that right now. Try again in a minute.");
  if (inv.status !== "paid") {
    const customer = await getCustomer(inv.customer_id, client);
    await notifyStaff({
      type: "accounting_client_reported_payment",
      title: `${inv.invoice_number}: client says payment sent`,
      message: `${customer ? customerLabel(customer) : "The customer"} says they sent ${money(balanceDue(inv))} by bank transfer. It matches automatically when the deposit reaches the Bank of America feed.`,
      entityType: "acct_invoice",
      entityId: inv.id,
      deepLink: `/admin/accounting/invoices/${inv.id}`,
      dedupeKey: `acct-client-paid-${inv.id}`,
    }).catch(() => undefined);
  }
  return { reportedAt: now };
}

// ── Invoices: create, edit, send ─────────────────────────────────────────────

type LineInput = { description: string; quantity: number; unit_cents: number };

function cleanLines(raw: unknown): LineInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => {
      const o = (l ?? {}) as Record<string, unknown>;
      const quantity = Number(o.quantity ?? 1);
      const unit = Number(o.unit_cents);
      return {
        description: typeof o.description === "string" ? o.description.trim().slice(0, 500) : "",
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity * 100) / 100 : 1,
        unit_cents: Number.isFinite(unit) && unit >= 0 ? Math.round(unit) : -1,
      };
    })
    .filter((l) => l.description && l.unit_cents >= 0);
}

export type CreateInvoiceInput = {
  entity?: unknown;
  customer_id?: unknown;
  issue_date?: unknown;
  due_days?: unknown;
  memo?: unknown;
  lines?: unknown;
  /** 1 for a single invoice; 2 to 36 for a monthly series. */
  repeat_count?: unknown;
  /** Email the first invoice now and let the rest send themselves on their dates. */
  send_now?: unknown;
};

async function nextNumber(entity: EntityId, client: Db): Promise<string> {
  const { data, error } = await client.rpc("next_acct_invoice_number", { p_entity: entity });
  if (error || !data) throw new Error(`Could not number the invoice: ${error?.message ?? "no number returned"}. Run the Accounting migration first.`);
  return data as string;
}

async function insertLines(invoiceId: string, lines: LineInput[], client: Db): Promise<void> {
  const rows = lines.map((l, i) => ({ invoice_id: invoiceId, position: i, description: l.description, quantity: l.quantity, unit_cents: l.unit_cents, amount_cents: lineAmount(l.quantity, l.unit_cents) }));
  const { error } = await client.from("acct_invoice_lines").insert(rows);
  if (error) throw new Error(`Could not save the invoice lines: ${error.message}`);
}

export async function createInvoices(input: CreateInvoiceInput, staffId: string, client: Db = db()): Promise<{ invoices: Invoice[]; emailed: boolean; emailError: string | null }> {
  const customerId = typeof input.customer_id === "string" ? input.customer_id : "";
  const customer = customerId ? await getCustomer(customerId, client) : null;
  if (!customer) throw new Error("Choose a customer.");
  const entity = isEntity(input.entity) ? input.entity : customer.entity;
  const lines = cleanLines(input.lines);
  if (lines.length === 0) throw new Error("Add at least one line with a description and an amount.");
  const issue = isIsoDate(input.issue_date) ? input.issue_date : todayPT();
  const dueDays = Math.max(0, Math.min(120, Math.floor(Number(input.due_days ?? 15)) || 0));
  const count = Math.max(1, Math.min(36, Math.floor(Number(input.repeat_count ?? 1)) || 1));
  const sendNow = input.send_now === true;
  const memo = str(input.memo, 2000);
  const today = todayPT();
  const seriesId = count > 1 ? crypto.randomUUID() : null;

  const created: Invoice[] = [];
  for (const [i, d] of seriesDates(issue, count, dueDays).entries()) {
    const itemLines = count > 1 ? lines.map((l) => ({ ...l, description: seriesLineLabel(l.description, i + 1, count) })) : lines;
    const total = invoiceTotal(itemLines.map((l) => ({ amount_cents: lineAmount(l.quantity, l.unit_cents) })));
    // Sending now: the first goes out today; the rest send themselves on their dates.
    const status = !sendNow ? "draft" : i === 0 && d.issue_date <= today ? "draft" : "scheduled";
    const { data, error } = await client
      .from("acct_invoices")
      .insert({
        entity, invoice_number: await nextNumber(entity, client), customer_id: customer.id, status,
        issue_date: d.issue_date, due_date: d.due_date, total_cents: total, memo,
        series_id: seriesId, series_index: seriesId ? i + 1 : null, series_count: seriesId ? count : null,
        created_by: staffId,
      })
      .select(INVOICE_COLS)
      .single();
    if (error || !data) throw new Error(`Could not create the invoice: ${error?.message ?? "no row"}`);
    await insertLines((data as Invoice).id, itemLines, client);
    created.push(data as Invoice);
  }

  let emailed = false;
  let emailError: string | null = null;
  if (sendNow && created[0].status === "draft") {
    try {
      const r = await sendInvoice(created[0].id, staffId, {}, client);
      emailed = r.emailed;
      created[0] = r.invoice;
    } catch (e) {
      emailError = e instanceof Error ? e.message : "Email failed.";
    }
  }
  return { invoices: created, emailed, emailError };
}

/** Draft and scheduled invoices can still be changed. */
export async function updateInvoice(id: string, input: CreateInvoiceInput & { due_date?: unknown }, client: Db = db()): Promise<Invoice> {
  const inv = await getInvoice(id, client);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.status !== "draft" && inv.status !== "scheduled") throw new Error("Only draft or scheduled invoices can be edited. Void it and create a new one instead.");
  const lines = cleanLines(input.lines);
  if (lines.length === 0) throw new Error("Add at least one line with a description and an amount.");
  const issue = isIsoDate(input.issue_date) ? input.issue_date : inv.issue_date;
  const due = isIsoDate(input.due_date) ? input.due_date : addDays(issue, Math.max(0, Math.floor(Number(input.due_days ?? 15)) || 0));
  if (due < issue) throw new Error("The due date can't be before the issue date.");
  const customerId = typeof input.customer_id === "string" && input.customer_id ? input.customer_id : inv.customer_id;
  const total = invoiceTotal(lines.map((l) => ({ amount_cents: lineAmount(l.quantity, l.unit_cents) })));
  await client.from("acct_invoice_lines").delete().eq("invoice_id", id);
  await insertLines(id, lines, client);
  const { data, error } = await client
    .from("acct_invoices")
    .update({ customer_id: customerId, issue_date: issue, due_date: due, memo: str(input.memo, 2000), total_cents: total, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(INVOICE_COLS)
    .single();
  if (error || !data) throw new Error(`Could not save the invoice: ${error?.message ?? "no row"}`);
  return data as Invoice;
}

export function publicPdfPath(inv: Pick<Invoice, "id" | "public_token">): string {
  return `/api/invoices/${inv.id}/pdf?t=${inv.public_token}`;
}

export async function invoicePdf(inv: Invoice, client: Db = db()): Promise<{ pdf: Buffer; fileName: string }> {
  const [lines, customer, instructions, series] = await Promise.all([
    getInvoiceLines(inv.id, client),
    getCustomer(inv.customer_id, client),
    getPaymentInstructions(inv.entity, client),
    seriesOf(inv, client),
  ]);
  if (!customer) throw new Error("Customer not found.");
  const pdf = await renderInvoicePdf({ invoice: inv, lines, customer, instructions, series });
  return { pdf, fileName: `${inv.invoice_number.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf` };
}

/** Email the invoice with its PDF. A draft or scheduled invoice becomes sent. */
export async function sendInvoice(id: string, staffId: string | null, opts: { to?: string | null; reminder?: boolean } = {}, client: Db = db()): Promise<{ invoice: Invoice; emailed: boolean }> {
  let inv = await getInvoice(id, client);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.status === "void") throw new Error("This invoice is void.");
  if (inv.status === "paid" && !opts.reminder) {
    // Re-sending a paid invoice sends the receipt version of the PDF; allowed.
  }
  const customer = await getCustomer(inv.customer_id, client);
  if (!customer) throw new Error("Customer not found.");
  const to = (opts.to ?? customer.email ?? "").trim();
  if (!to) throw new Error("This customer has no email address. Add one on the customer first.");

  if (inv.status === "draft" || inv.status === "scheduled") {
    const { data } = await client
      .from("acct_invoices")
      .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(INVOICE_COLS)
      .single();
    if (data) inv = data as Invoice;
  }
  const [lines, instructions, series] = await Promise.all([getInvoiceLines(id, client), getPaymentInstructions(inv.entity, client), seriesOf(inv, client)]);
  const pdf = await renderInvoicePdf({ invoice: inv, lines, customer, instructions, series });
  // The full schedule goes on the first invoice of a series only.
  const showSeries = inv.series_index === 1 ? series : undefined;
  const rendered = renderInvoiceEmail({
    invoice: inv, lines, customer, instructions, pdfUrl: absoluteUrl(publicPdfPath(inv)),
    payUrl: inv.status === "sent" ? absoluteUrl(payPagePath(inv)) : null,
    series: showSeries, reminder: opts.reminder,
  });
  const emailed = await sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    fromName: inv.entity === "icfo_venture_group" ? "iCFO Venture Group" : "iCFO Capital",
    attachments: [{ filename: `${inv.invoice_number}.pdf`, content: pdf.toString("base64") }],
    source: "accounting_invoice",
    audience: "external",
    triggeredBy: staffId,
  });
  if (!emailed) throw new Error("The email could not be sent. Check the address and try again.");
  const { data } = await client.from("acct_invoices").update({ last_emailed_to: to, updated_at: new Date().toISOString() }).eq("id", id).select(INVOICE_COLS).single();
  return { invoice: (data as Invoice) ?? inv, emailed };
}

export async function voidInvoice(id: string, client: Db = db()): Promise<Invoice> {
  const inv = await getInvoice(id, client);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.amount_paid_cents > 0) throw new Error("This invoice has payments recorded. Remove them before voiding.");
  const { data, error } = await client.from("acct_invoices").update({ status: "void", voided_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).select(INVOICE_COLS).single();
  if (error || !data) throw new Error(error?.message ?? "Could not void the invoice.");
  return data as Invoice;
}

export async function deleteDraft(id: string, client: Db = db()): Promise<void> {
  const inv = await getInvoice(id, client);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.status !== "draft" && inv.status !== "scheduled") throw new Error("Only draft or scheduled invoices can be deleted. Void a sent invoice instead.");
  const { error } = await client.from("acct_invoices").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function recordPayment(
  invoiceId: string,
  input: { amount_cents: number; paid_on?: string; method?: PaymentMethod; reference?: string | null; bank_transaction_id?: string | null; send_receipt?: boolean },
  /** Null when the bank feed matched the deposit on its own. */
  staffId: string | null,
  client: Db = db(),
): Promise<{ invoice: Invoice; receiptSent: boolean }> {
  const inv = await getInvoice(invoiceId, client);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.status === "void") throw new Error("This invoice is void.");
  if (inv.status === "draft" || inv.status === "scheduled") throw new Error("Send the invoice before recording a payment on it.");
  const amount = Math.round(input.amount_cents);
  if (!(amount > 0)) throw new Error("Enter the amount received.");
  if (amount > balanceDue(inv)) throw new Error(`That is more than the balance due on ${inv.invoice_number}.`);
  const paidOn = isIsoDate(input.paid_on) ? input.paid_on : todayPT();
  const { error } = await client.from("acct_payments").insert({
    invoice_id: invoiceId,
    amount_cents: amount,
    paid_on: paidOn,
    method: isPaymentMethod(input.method) ? input.method : "ach",
    reference: input.reference?.trim().slice(0, 200) || null,
    bank_transaction_id: input.bank_transaction_id ?? null,
    recorded_by: staffId,
  });
  if (error) throw new Error(`Could not record the payment: ${error.message}`);
  const paid = inv.amount_paid_cents + amount;
  const full = paid >= inv.total_cents;
  const { data } = await client
    .from("acct_invoices")
    .update({ amount_paid_cents: paid, status: full ? "paid" : "sent", paid_at: full ? new Date(`${paidOn}T20:00:00Z`).toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select(INVOICE_COLS)
    .single();
  const updated = (data as Invoice) ?? inv;

  let receiptSent = false;
  if (input.send_receipt) {
    const customer = await getCustomer(updated.customer_id, client);
    if (customer?.email) {
      const r = renderReceiptEmail({ invoice: updated, customer, amountCents: amount, paidOn, pdfUrl: absoluteUrl(publicPdfPath(updated)) });
      receiptSent = await sendEmail({ to: customer.email, subject: r.subject, html: r.html, text: r.text, fromName: "iCFO Capital", source: "accounting_receipt", audience: "external", triggeredBy: staffId });
    }
  }
  return { invoice: updated, receiptSent };
}

export async function deletePayment(paymentId: string, client: Db = db()): Promise<Invoice> {
  const { data: p } = await client.from("acct_payments").select("id, invoice_id, amount_cents, bank_transaction_id").eq("id", paymentId).maybeSingle();
  if (!p) throw new Error("Payment not found.");
  const pay = p as { invoice_id: string; amount_cents: number; bank_transaction_id: string | null };
  await client.from("acct_payments").delete().eq("id", paymentId);
  if (pay.bank_transaction_id) {
    await client.from("acct_bank_transactions").update({ status: "review", matched_invoice_id: null, decided_by: null, decided_at: null }).eq("id", pay.bank_transaction_id);
  }
  const inv = await getInvoice(pay.invoice_id, client);
  if (!inv) throw new Error("Invoice not found.");
  const paid = Math.max(0, inv.amount_paid_cents - pay.amount_cents);
  const { data } = await client.from("acct_invoices").update({ amount_paid_cents: paid, status: "sent", paid_at: null, updated_at: new Date().toISOString() }).eq("id", inv.id).select(INVOICE_COLS).single();
  return (data as Invoice) ?? inv;
}

export type PaymentListRow = Payment & { invoice_number: string; customerName: string };

export async function listPayments(client: Db = db()): Promise<PaymentListRow[]> {
  const { data } = await client.from("acct_payments").select("id, invoice_id, amount_cents, paid_on, method, reference, bank_transaction_id, created_at").order("paid_on", { ascending: false }).limit(1000);
  const pays = (data ?? []) as Payment[];
  const invIds = [...new Set(pays.map((p) => p.invoice_id))];
  const { data: invs } = invIds.length ? await client.from("acct_invoices").select("id, invoice_number, customer_id").in("id", invIds) : { data: [] };
  const invMap = new Map(((invs ?? []) as Array<{ id: string; invoice_number: string; customer_id: string }>).map((i) => [i.id, i]));
  const custIds = [...new Set([...invMap.values()].map((i) => i.customer_id))];
  const { data: cs } = custIds.length ? await client.from("acct_customers").select(CUSTOMER_COLS).in("id", custIds) : { data: [] };
  const custMap = new Map(((cs ?? []) as Customer[]).map((c) => [c.id, c]));
  return pays.map((p) => {
    const i = invMap.get(p.invoice_id);
    return { ...p, invoice_number: i?.invoice_number ?? "Unknown", customerName: customerLabel(i ? custMap.get(i.customer_id) : null) };
  });
}

// ── Bank: Plaid tokens ───────────────────────────────────────────────────────

const ENC_PREFIX = "v1:";
function encKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET?.trim();
  if (!secret) throw new Error("TOKEN_ENCRYPTION_SECRET is not set, so the bank connection can't be stored safely.");
  return scryptSync(secret, "icapos-accounting-plaid", 32);
}
function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ENC_PREFIX + Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}
function decrypt(cipher: string): string {
  if (!cipher.startsWith(ENC_PREFIX)) throw new Error("Unsupported token format.");
  const raw = Buffer.from(cipher.slice(ENC_PREFIX.length), "base64");
  const d = createDecipheriv("aes-256-gcm", encKey(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

export type BankItemRow = { id: string; entity: EntityId; plaid_item_id: string; access_token_enc: string; institution_name: string | null; sync_cursor: string | null; status: string; last_error: string | null; last_synced_at: string | null };
export type BankAccountRow = { id: string; entity: EntityId; item_id: string | null; plaid_account_id: string | null; name: string; mask: string | null; type: string | null; subtype: string | null; current_balance_cents: number | null; available_balance_cents: number | null; balance_at: string | null };

export async function createPlaidLinkToken(staffId: string, reconnectItemId?: string | null, client: Db = db()): Promise<string> {
  if (reconnectItemId) {
    const { data } = await client.from("acct_bank_items").select("access_token_enc").eq("id", reconnectItemId).maybeSingle();
    if (!data) throw new Error("Bank connection not found.");
    return plaid.createLinkToken(staffId, decrypt((data as { access_token_enc: string }).access_token_enc));
  }
  return plaid.createLinkToken(staffId);
}

export async function connectPlaid(input: { public_token: string; institution_name?: string | null; entity?: unknown }, staffId: string, client: Db = db()): Promise<{ itemId: string; accounts: number; sync: SyncResult }> {
  const { accessToken, itemId } = await plaid.exchangePublicToken(input.public_token);
  const entity = isEntity(input.entity) ? input.entity : DEFAULT_ENTITY;
  const { data, error } = await client
    .from("acct_bank_items")
    .upsert({ plaid_item_id: itemId, access_token_enc: encrypt(accessToken), institution_name: input.institution_name?.slice(0, 120) ?? null, entity, status: "active", last_error: null, created_by: staffId }, { onConflict: "plaid_item_id" })
    .select("id, entity, plaid_item_id, access_token_enc, institution_name, sync_cursor, status, last_error, last_synced_at")
    .single();
  if (error || !data) throw new Error(`Could not save the bank connection: ${error?.message ?? "no row"}`);
  const item = data as BankItemRow;
  const accounts = await refreshAccounts(item, accessToken, client);
  const sync = await syncItem(item, client);
  return { itemId: item.id, accounts, sync };
}

/** After reconnecting through Link update mode the item works again. */
export async function markReconnected(itemId: string, client: Db = db()): Promise<SyncResult> {
  await client.from("acct_bank_items").update({ status: "active", last_error: null }).eq("id", itemId);
  const { data } = await client.from("acct_bank_items").select("id, entity, plaid_item_id, access_token_enc, institution_name, sync_cursor, status, last_error, last_synced_at").eq("id", itemId).maybeSingle();
  if (!data) throw new Error("Bank connection not found.");
  return syncItem(data as BankItemRow, client);
}

async function refreshAccounts(item: BankItemRow, accessToken: string, client: Db): Promise<number> {
  const accounts = await plaid.getAccounts(accessToken);
  const now = new Date().toISOString();
  for (const a of accounts) {
    await client.from("acct_bank_accounts").upsert({
      entity: item.entity,
      item_id: item.id,
      plaid_account_id: a.account_id,
      name: a.official_name || a.name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      current_balance_cents: a.balances.current == null ? null : Math.round(a.balances.current * 100),
      available_balance_cents: a.balances.available == null ? null : Math.round(a.balances.available * 100),
      balance_at: now,
    }, { onConflict: "plaid_account_id" });
  }
  return accounts.length;
}

export type SyncResult = { added: number; updated: number; removed: number; suggested: number; autoMatched?: number; errors: string[] };

async function syncItem(item: BankItemRow, client: Db): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, removed: 0, suggested: 0, errors: [] };
  try {
    const token = decrypt(item.access_token_enc);
    await refreshAccounts(item, token, client);
    const { data: accts } = await client.from("acct_bank_accounts").select("id, plaid_account_id").eq("item_id", item.id);
    const acctMap = new Map(((accts ?? []) as Array<{ id: string; plaid_account_id: string }>).map((a) => [a.plaid_account_id, a.id]));
    const s = await plaid.syncTransactions(token, item.sync_cursor);
    const upserts = [...s.added, ...s.modified]
      .filter((t) => acctMap.has(t.account_id))
      .map((t) => ({
        account_id: acctMap.get(t.account_id),
        source: "plaid",
        external_id: t.transaction_id,
        posted_on: t.date,
        description: (t.name || t.merchant_name || "Bank transaction").slice(0, 300),
        merchant: t.merchant_name ?? null,
        amount_cents: plaidAmountToCents(t.amount),
        pending: t.pending,
      }));
    for (let i = 0; i < upserts.length; i += 200) {
      // ignoreDuplicates is false: a modified row updates amount, date and pending,
      // while status, category and match (not in the payload) are kept.
      const { error } = await client.from("acct_bank_transactions").upsert(upserts.slice(i, i + 200), { onConflict: "account_id,external_id" });
      if (error) throw new Error(error.message);
    }
    result.added = s.added.length;
    result.updated = s.modified.length;
    if (s.removed.length) {
      await client.from("acct_bank_transactions").delete().in("external_id", s.removed).eq("source", "plaid").neq("status", "matched");
      result.removed = s.removed.length;
    }
    await client.from("acct_bank_items").update({ sync_cursor: s.nextCursor, last_synced_at: new Date().toISOString(), status: "active", last_error: null }).eq("id", item.id);
    result.autoMatched = await autoMatchDeposits([...acctMap.values()], client, result.errors);
  } catch (e) {
    const needsLogin = e instanceof plaid.PlaidError && e.needsLogin;
    const msg = e instanceof Error ? e.message : "Sync failed.";
    result.errors.push(msg);
    await client.from("acct_bank_items").update({ status: needsLogin ? "needs_login" : "error", last_error: msg.slice(0, 500) }).eq("id", item.id);
  }
  return result;
}

/**
 * Posted deposits still waiting for review that name exactly one open invoice
 * and equal its balance: record the payment, mark the invoice paid and email
 * the receipt. Everything else stays for staff to decide in Bank.
 */
async function autoMatchDeposits(accountIds: string[], client: Db, errors: string[]): Promise<number> {
  if (accountIds.length === 0) return 0;
  const { data } = await client.from("acct_bank_transactions").select(TX_COLS).in("account_id", accountIds).eq("status", "review").eq("pending", false).gt("amount_cents", 0).order("posted_on").limit(200);
  const deposits = (data ?? []) as BankTransaction[];
  if (deposits.length === 0) return 0;
  let open = await openInvoiceCandidates(client);
  let matched = 0;
  for (const tx of deposits) {
    const hit = autoMatch({ ...tx, amount_cents: Number(tx.amount_cents) }, open);
    if (!hit) continue;
    try {
      await decideTransaction(tx.id, { action: "match", invoice_id: hit.id, send_receipt: true }, null, client);
      open = open.filter((i) => i.id !== hit.id);
      matched++;
    } catch (e) {
      errors.push(`Auto match ${hit.invoice_number}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  return matched;
}

export async function syncAllBanks(client: Db = db()): Promise<SyncResult> {
  const total: SyncResult = { added: 0, updated: 0, removed: 0, suggested: 0, errors: [] };
  if (!plaid.plaidConfigured()) return total;
  const { data } = await client.from("acct_bank_items").select("id, entity, plaid_item_id, access_token_enc, institution_name, sync_cursor, status, last_error, last_synced_at").neq("status", "removed");
  for (const item of (data ?? []) as BankItemRow[]) {
    const r = await syncItem(item, client);
    total.added += r.added; total.updated += r.updated; total.removed += r.removed; total.errors.push(...r.errors);
    total.autoMatched = (total.autoMatched ?? 0) + (r.autoMatched ?? 0);
  }
  return total;
}

export async function disconnectBank(itemId: string, client: Db = db()): Promise<void> {
  const { data } = await client.from("acct_bank_items").select("access_token_enc").eq("id", itemId).maybeSingle();
  if (!data) throw new Error("Bank connection not found.");
  try {
    await plaid.removeItem(decrypt((data as { access_token_enc: string }).access_token_enc));
  } catch (e) {
    console.warn("[accounting] plaid item remove failed", e);
  }
  // Transactions stay (they are the books); the connection is closed.
  await client.from("acct_bank_items").update({ status: "removed", access_token_enc: "removed", sync_cursor: null }).eq("id", itemId);
}

// ── Bank: file import ────────────────────────────────────────────────────────

export async function importBankFile(input: { text: string; account_id?: string | null; account_name?: string | null; entity?: unknown }, client: Db = db()): Promise<{ imported: number; skipped: number; accountId: string }> {
  const rows = parseBankFile(input.text ?? "");
  if (rows.length === 0) throw new Error("No transactions found. Download the file from Bank of America as CSV (Microsoft Excel format) or Quicken (QFX).");
  let accountId = typeof input.account_id === "string" && input.account_id ? input.account_id : null;
  if (!accountId) {
    const { data, error } = await client
      .from("acct_bank_accounts")
      .insert({ entity: isEntity(input.entity) ? input.entity : DEFAULT_ENTITY, name: str(input.account_name, 120) ?? "Bank of America (imported)" })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Could not create the account: ${error?.message ?? "no row"}`);
    accountId = (data as { id: string }).id;
  }
  const { data: existing } = await client.from("acct_bank_transactions").select("external_id").eq("account_id", accountId).in("external_id", rows.map((r) => r.external_id));
  const have = new Set(((existing ?? []) as Array<{ external_id: string }>).map((r) => r.external_id));
  const fresh = rows.filter((r) => !have.has(r.external_id)).map((r) => ({ ...r, account_id: accountId, source: "import" }));
  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await client.from("acct_bank_transactions").insert(fresh.slice(i, i + 200));
    if (error) throw new Error(`Import stopped: ${error.message}`);
  }
  return { imported: fresh.length, skipped: rows.length - fresh.length, accountId };
}

// ── Bank: review ─────────────────────────────────────────────────────────────

export type BankTxRow = BankTransaction & { accountName: string; suggestion: { invoiceId: string; invoiceNumber: string; customer: string } | null; matchedNumber: string | null };

export async function listBank(opts: { status?: string } = {}, client: Db = db()): Promise<{
  items: Array<Omit<BankItemRow, "access_token_enc" | "sync_cursor">>;
  accounts: BankAccountRow[];
  transactions: BankTxRow[];
  counts: Record<string, number>;
}> {
  const [itemsRes, acctRes] = await Promise.all([
    client.from("acct_bank_items").select("id, entity, plaid_item_id, institution_name, status, last_error, last_synced_at").neq("status", "removed").order("created_at"),
    client.from("acct_bank_accounts").select("id, entity, item_id, plaid_account_id, name, mask, type, subtype, current_balance_cents, available_balance_cents, balance_at").order("created_at"),
  ]);
  const accounts = (acctRes.data ?? []) as BankAccountRow[];
  const acctName = new Map(accounts.map((a) => [a.id, a.mask ? `${a.name} ••${a.mask}` : a.name]));
  let q = client.from("acct_bank_transactions").select(TX_COLS).order("posted_on", { ascending: false }).limit(500);
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  const { data: txData } = await q;
  const txs = (txData ?? []) as BankTransaction[];

  const counts: Record<string, number> = {};
  for (const s of ["review", "matched", "categorized", "ignored"]) {
    const { count } = await client.from("acct_bank_transactions").select("id", { count: "exact", head: true }).eq("status", s);
    counts[s] = count ?? 0;
  }

  const open = await openInvoiceCandidates(client);
  const matchedIds = [...new Set(txs.map((t) => t.matched_invoice_id).filter((x): x is string => Boolean(x)))];
  const { data: matched } = matchedIds.length ? await client.from("acct_invoices").select("id, invoice_number").in("id", matchedIds) : { data: [] };
  const matchedMap = new Map(((matched ?? []) as Array<{ id: string; invoice_number: string }>).map((m) => [m.id, m.invoice_number]));

  const transactions = txs.map((t) => {
    const s = t.status === "review" ? suggestMatch(t, open) : null;
    return {
      ...t,
      amount_cents: Number(t.amount_cents),
      accountName: acctName.get(t.account_id) ?? "Bank account",
      suggestion: s ? { invoiceId: s.id, invoiceNumber: s.invoice_number, customer: s.customerLabel ?? "" } : null,
      matchedNumber: t.matched_invoice_id ? matchedMap.get(t.matched_invoice_id) ?? null : null,
    };
  });
  return { items: (itemsRes.data ?? []) as BankItemRow[], accounts, transactions, counts };
}

async function openInvoiceCandidates(client: Db): Promise<MatchCandidate[]> {
  const { data } = await client.from("acct_invoices").select("id, invoice_number, customer_id, status, due_date, total_cents, amount_paid_cents").eq("status", "sent").limit(1000);
  const rows = (data ?? []) as MatchCandidate[];
  const ids = [...new Set(rows.map((r) => r.customer_id))];
  const { data: cs } = ids.length ? await client.from("acct_customers").select("id, company, contact_name").in("id", ids) : { data: [] };
  const names = new Map(((cs ?? []) as Array<{ id: string; company: string | null; contact_name: string | null }>).map((c) => [c.id, c.company || c.contact_name || ""]));
  return rows.map((r) => ({ ...r, customerLabel: names.get(r.customer_id) ?? "" }));
}

export async function openInvoicesForPicker(client: Db = db()): Promise<Array<{ id: string; invoice_number: string; customer: string; balance_cents: number; due_date: string }>> {
  const rows = await openInvoiceCandidates(client);
  return rows.map((r) => ({ id: r.id, invoice_number: r.invoice_number, customer: r.customerLabel ?? "", balance_cents: balanceDue(r), due_date: r.due_date })).sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export type BankDecision =
  | { action: "match"; invoice_id: string; send_receipt?: boolean }
  | { action: "categorize"; category: string }
  | { action: "ignore" }
  | { action: "reset" };

export async function decideTransaction(txId: string, d: BankDecision, staffId: string | null, client: Db = db()): Promise<{ ok: true; invoice?: Invoice }> {
  const { data } = await client.from("acct_bank_transactions").select(TX_COLS).eq("id", txId).maybeSingle();
  const tx = data as BankTransaction | null;
  if (!tx) throw new Error("Transaction not found.");
  const stamp = { decided_by: staffId, decided_at: new Date().toISOString() };

  if (d.action === "match") {
    if (tx.status === "matched") throw new Error("This deposit is already matched.");
    const amount = Number(tx.amount_cents);
    if (amount <= 0) throw new Error("Only deposits can pay an invoice.");
    const inv = await getInvoice(d.invoice_id, client);
    if (!inv) throw new Error("Invoice not found.");
    const r = await recordPayment(inv.id, { amount_cents: Math.min(amount, balanceDue(inv)), paid_on: tx.posted_on, method: "ach", reference: tx.description.slice(0, 200), bank_transaction_id: tx.id, send_receipt: d.send_receipt }, staffId, client);
    await client.from("acct_bank_transactions").update({ status: "matched", matched_invoice_id: inv.id, category: "Invoice payment", ...stamp }).eq("id", txId);
    return { ok: true, invoice: r.invoice };
  }
  if (tx.status === "matched") throw new Error("Remove the payment on the invoice first to undo this match.");
  if (d.action === "categorize") {
    const category = d.category?.trim().slice(0, 80);
    if (!category) throw new Error("Choose a category.");
    await client.from("acct_bank_transactions").update({ status: "categorized", category, ...stamp }).eq("id", txId);
  } else if (d.action === "ignore") {
    await client.from("acct_bank_transactions").update({ status: "ignored", ...stamp }).eq("id", txId);
  } else {
    await client.from("acct_bank_transactions").update({ status: "review", category: null, decided_by: null, decided_at: null }).eq("id", txId);
  }
  return { ok: true };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export type AccountingSummary = {
  openCount: number;
  openCents: number;
  overdueCount: number;
  overdueCents: number;
  scheduledCount: number;
  scheduledCents: number;
  draftCount: number;
  paid30Cents: number;
  paid30Count: number;
  bankBalanceCents: number | null;
  bankBalanceAt: string | null;
  bankToReview: number;
  plaidReady: boolean;
};

export async function accountingSummary(client: Db = db()): Promise<AccountingSummary> {
  const today = todayPT();
  const since = addDays(today, -30);
  const [{ data: invs }, { data: pays }, { data: accts }, { count: review }] = await Promise.all([
    client.from("acct_invoices").select("status, due_date, total_cents, amount_paid_cents").in("status", ["sent", "scheduled", "draft"]),
    client.from("acct_payments").select("amount_cents").gte("paid_on", since),
    client.from("acct_bank_accounts").select("current_balance_cents, balance_at").not("current_balance_cents", "is", null),
    client.from("acct_bank_transactions").select("id", { count: "exact", head: true }).eq("status", "review"),
  ]);
  const s: AccountingSummary = {
    openCount: 0, openCents: 0, overdueCount: 0, overdueCents: 0, scheduledCount: 0, scheduledCents: 0, draftCount: 0,
    paid30Cents: 0, paid30Count: 0, bankBalanceCents: null, bankBalanceAt: null, bankToReview: review ?? 0, plaidReady: plaid.plaidConfigured(),
  };
  for (const i of (invs ?? []) as Array<Pick<Invoice, "status" | "due_date" | "total_cents" | "amount_paid_cents">>) {
    if (i.status === "draft") s.draftCount++;
    else if (i.status === "scheduled") { s.scheduledCount++; s.scheduledCents += i.total_cents; }
    else {
      const due = balanceDue(i);
      s.openCount++; s.openCents += due;
      if (displayStatus(i, today) === "overdue") { s.overdueCount++; s.overdueCents += due; }
    }
  }
  for (const p of (pays ?? []) as Array<{ amount_cents: number }>) { s.paid30Cents += p.amount_cents; s.paid30Count++; }
  const bal = (accts ?? []) as Array<{ current_balance_cents: number; balance_at: string | null }>;
  if (bal.length) {
    s.bankBalanceCents = bal.reduce((t, a) => t + Number(a.current_balance_cents), 0);
    s.bankBalanceAt = bal.map((a) => a.balance_at).filter(Boolean).sort().at(-1) ?? null;
  }
  return s;
}

// ── Daily cron ───────────────────────────────────────────────────────────────

/** Sends scheduled invoices whose issue date has come, then syncs the bank feed. */
export async function runAccountingDaily(client: Db = db()): Promise<{ sent: number; sendErrors: string[]; bank: SyncResult }> {
  const today = todayPT();
  const { data } = await client.from("acct_invoices").select("id, invoice_number").eq("status", "scheduled").lte("issue_date", today).limit(200);
  let sent = 0;
  const sendErrors: string[] = [];
  for (const row of (data ?? []) as Array<{ id: string; invoice_number: string }>) {
    try {
      await sendInvoice(row.id, null, {}, client);
      sent++;
    } catch (e) {
      sendErrors.push(`${row.invoice_number}: ${e instanceof Error ? e.message : "send failed"}`);
    }
  }
  const bank = await syncAllBanks(client);
  return { sent, sendErrors, bank };
}
