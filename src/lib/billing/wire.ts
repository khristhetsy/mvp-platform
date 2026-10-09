/**
 * Premium by bank wire: server side. Approved Oct 9, 2026.
 *
 * Premium is paid ONLY by wire, monthly ($1,000) or quarterly ($3,000, no
 * discount). A founder requests an invoice, wires the amount with the invoice
 * number as the reference, and staff mark it received in Admin, Billing, Wire
 * payments, which activates Premium. The daily cron (/api/cron/wire-invoices)
 * flags overdue invoices, issues renewals 7 days before a period ends and pauses
 * Premium services 10 days past due.
 *
 * No money moves through iCapOS: this records invoices and their status only.
 * Pure helpers live in wire-core.ts (tested); founder emails in wire-emails.ts.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { createNotification } from "@/lib/notifications/notifications";
import { alertStaffNewCustomer } from "@/lib/notifications/new-customer-alerts";
import { sendFounderWelcomeLetter } from "@/lib/notifications/founder-welcome-letter";
import { emailDispatchAllowedForUser } from "@/lib/organizations/organizations";
import { loadPricing } from "@/lib/subscriptions/pricing-server";
import { centsFor } from "@/lib/subscriptions/pricing-catalog";
import {
  activationPeriod, cycleMonths, daysOverdue, dueDateFor, EMPTY_WIRE_INSTRUCTIONS, invoiceAmountCents,
  isOpenStatus, needsRenewalInvoice, normalizeWireInstructions, periodEnd, PREMIUM_MONTHLY_CENTS,
  shouldPausePremium, statusFor, type WireCycle, type WireInstructions, type WireInvoiceRow,
} from "@/lib/billing/wire-core";
import {
  renderWireInvoiceEmail, renderWirePausedEmail, renderWireReceiptEmail, renderWireReminderEmail,
} from "@/lib/billing/wire-emails";

/* eslint-disable @typescript-eslint/no-explicit-any */
// wire_invoices and next_wire_invoice_number() are not in the generated types
// yet (migration 20261009200000); same cast the listing code uses.
type Db = any;

export const WIRE_INSTRUCTIONS_KEY = "wire_instructions";
const INVOICE_COLS =
  "id, invoice_number, profile_id, company_id, plan_type, billing_cycle, amount_cents, currency, status, issued_at, due_at, period_start, period_end, received_at, received_by, reminder_sent_at, is_renewal, notes, created_at";

function db(): Db {
  return createServiceRoleClient() as Db;
}

// ── Wire instructions (platform_settings) ────────────────────────────────────

export async function getWireInstructions(client: Db = db()): Promise<WireInstructions> {
  try {
    const { data } = await client.from("platform_settings").select("value").eq("key", WIRE_INSTRUCTIONS_KEY).maybeSingle();
    const value = (data as { value?: unknown } | null)?.value;
    return value ? normalizeWireInstructions(value) : { ...EMPTY_WIRE_INSTRUCTIONS };
  } catch {
    return { ...EMPTY_WIRE_INSTRUCTIONS };
  }
}

export async function saveWireInstructions(input: unknown, staffId: string | null, client: Db = db()): Promise<WireInstructions> {
  const clean = normalizeWireInstructions(input);
  const { error } = await client
    .from("platform_settings")
    .upsert({ key: WIRE_INSTRUCTIONS_KEY, value: clean, updated_by: staffId, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Could not save wire instructions: ${error.message}`);
  return clean;
}

// ── Reads ────────────────────────────────────────────────────────────────────

/** Stored status with "awaiting" shown as "overdue" once the due date passes. */
function present(row: WireInvoiceRow, now = new Date()): WireInvoiceRow {
  return { ...row, status: statusFor(row, now) };
}

export async function getWireInvoice(id: string, client: Db = db()): Promise<WireInvoiceRow | null> {
  const { data } = await client.from("wire_invoices").select(INVOICE_COLS).eq("id", id).maybeSingle();
  return data ? present(data as WireInvoiceRow) : null;
}

export async function listWireInvoicesForProfile(profileId: string, client: Db = db()): Promise<WireInvoiceRow[]> {
  const { data } = await client.from("wire_invoices").select(INVOICE_COLS).eq("profile_id", profileId).order("issued_at", { ascending: false }).limit(50);
  return ((data ?? []) as WireInvoiceRow[]).map((r) => present(r));
}

export async function openWireInvoiceForProfile(profileId: string, client: Db = db()): Promise<WireInvoiceRow | null> {
  const { data } = await client
    .from("wire_invoices")
    .select(INVOICE_COLS)
    .eq("profile_id", profileId)
    .in("status", ["awaiting", "overdue"])
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? present(data as WireInvoiceRow) : null;
}

export type AdminWireInvoice = WireInvoiceRow & {
  founderName: string | null;
  founderEmail: string | null;
  companyName: string | null;
  daysOverdue: number;
};

export async function listWireInvoicesForAdmin(limit = 500, client: Db = db()): Promise<AdminWireInvoice[]> {
  const { data } = await client.from("wire_invoices").select(INVOICE_COLS).order("issued_at", { ascending: false }).limit(limit);
  const rows = ((data ?? []) as WireInvoiceRow[]).map((r) => present(r));
  if (!rows.length) return [];
  const profileIds = [...new Set(rows.map((r) => r.profile_id))];
  const companyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: companies }] = await Promise.all([
    client.from("profiles").select("id, full_name, email").in("id", profileIds),
    companyIds.length ? client.from("companies").select("id, company_name").in("id", companyIds) : Promise.resolve({ data: [] }),
  ]);
  const p = new Map(((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((x) => [x.id, x]));
  const c = new Map(((companies ?? []) as Array<{ id: string; company_name: string | null }>).map((x) => [x.id, x.company_name]));
  const now = new Date();
  return rows.map((r) => ({
    ...r,
    founderName: p.get(r.profile_id)?.full_name ?? null,
    founderEmail: p.get(r.profile_id)?.email ?? null,
    companyName: r.company_id ? c.get(r.company_id) ?? null : null,
    daysOverdue: daysOverdue(r, now),
  }));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function premiumMonthlyCents(): Promise<number> {
  try {
    const cents = centsFor(await loadPricing(), "founder_premium");
    return cents > 0 ? cents : PREMIUM_MONTHLY_CENTS;
  } catch {
    return PREMIUM_MONTHLY_CENTS;
  }
}

async function founderContact(profileId: string, client: Db): Promise<{ email: string | null; firstName: string | null }> {
  const { data } = await client.from("profiles").select("email, full_name").eq("id", profileId).maybeSingle();
  const row = data as { email: string | null; full_name: string | null } | null;
  return { email: row?.email ?? null, firstName: row?.full_name?.trim().split(/\s+/)[0] ?? null };
}

/** Demo and internal founder accounts never send real email. */
async function mayEmail(profileId: string, client: Db): Promise<boolean> {
  try {
    return await emailDispatchAllowedForUser(client, profileId);
  } catch {
    return true;
  }
}

export const wirePdfPath = (id: string) => `/api/billing/wire-invoice/${id}/pdf`;
const BILLING_PATH = "/billing";

async function emailFounder(profileId: string, rendered: { subject: string; html: string; text: string }, source: string, client: Db, triggeredBy?: string | null): Promise<boolean> {
  const contact = await founderContact(profileId, client);
  if (!contact.email) return false;
  if (!(await mayEmail(profileId, client))) return false;
  return sendEmail({
    to: contact.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    source,
    audience: "founder",
    triggeredBy: triggeredBy ?? null,
    tags: [{ name: "kind", value: source }],
  });
}

// ── Create ───────────────────────────────────────────────────────────────────

export type CreateWireInvoiceInput = {
  profileId: string;
  companyId: string | null;
  cycle: WireCycle;
  isRenewal?: boolean;
  /** Start of the period this invoice pays for. Defaults to now. */
  periodStart?: Date | string | null;
};

export type CreateWireInvoiceResult = { invoice: WireInvoiceRow; emailed: boolean; reused: boolean };

/**
 * Issues an invoice and emails it with the wire instructions. A founder who
 * already has an open invoice for the same cycle gets that one back rather than
 * a duplicate; switching cycle voids the old open invoice first. Renewals never
 * void anything.
 */
export async function createWireInvoice(input: CreateWireInvoiceInput, client: Db = db()): Promise<CreateWireInvoiceResult> {
  const open = await openWireInvoiceForProfile(input.profileId, client);
  if (open) {
    if (open.billing_cycle === input.cycle || input.isRenewal) return { invoice: open, emailed: false, reused: true };
    await client.from("wire_invoices").update({ status: "void", notes: "Replaced by a new invoice for a different billing cycle." }).eq("id", open.id);
  }

  const { data: number, error: numberError } = await client.rpc("next_wire_invoice_number");
  if (numberError || typeof number !== "string") throw new Error(`Could not number the invoice: ${numberError?.message ?? "no number returned"}`);

  const issued = new Date();
  const start = input.periodStart ? new Date(input.periodStart) : issued;
  const amount = invoiceAmountCents(input.cycle, await premiumMonthlyCents());
  const row = {
    invoice_number: number,
    profile_id: input.profileId,
    company_id: input.companyId,
    plan_type: "founder_premium",
    billing_cycle: input.cycle,
    amount_cents: amount,
    currency: "USD",
    status: "awaiting",
    issued_at: issued.toISOString(),
    due_at: dueDateFor(issued).toISOString(),
    period_start: start.toISOString(),
    period_end: periodEnd(start, input.cycle).toISOString(),
    is_renewal: Boolean(input.isRenewal),
  };
  const { data, error } = await client.from("wire_invoices").insert(row).select(INVOICE_COLS).single();
  if (error || !data) throw new Error(`Could not create the invoice: ${error?.message ?? "no row returned"}`);
  const invoice = data as WireInvoiceRow;

  let emailed = false;
  try {
    const contact = await founderContact(input.profileId, client);
    const rendered = renderWireInvoiceEmail({
      firstName: contact.firstName,
      invoice,
      instructions: await getWireInstructions(client),
      billingUrl: absoluteUrl(BILLING_PATH),
      pdfUrl: absoluteUrl(wirePdfPath(invoice.id)),
      isRenewal: Boolean(input.isRenewal),
    });
    emailed = await emailFounder(input.profileId, rendered, "wire_invoice", client);
  } catch (e) {
    console.warn("[billing/wire] invoice email failed", e);
  }
  return { invoice, emailed, reused: false };
}

// ── Staff actions ────────────────────────────────────────────────────────────

export type MarkReceivedResult = {
  invoice: WireInvoiceRow;
  emailed: boolean;
  /** Set when the founder still has a Lemon Squeezy subscription that would keep charging. */
  warning: string | null;
};

export async function markWireReceived(invoiceId: string, staffId: string, client: Db = db()): Promise<MarkReceivedResult> {
  const invoice = await getWireInvoice(invoiceId, client);
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "void") throw new Error("This invoice is void. Issue a new invoice instead.");
  if (invoice.status === "received") return { invoice, emailed: false, warning: null };

  const receivedAt = new Date();
  const period = activationPeriod(invoice, receivedAt);
  const { data: updated, error } = await client
    .from("wire_invoices")
    .update({
      status: "received",
      received_at: receivedAt.toISOString(),
      received_by: staffId,
      period_start: period.start.toISOString(),
      period_end: period.end.toISOString(),
    })
    .eq("id", invoiceId)
    .in("status", ["awaiting", "overdue"])
    .select(INVOICE_COLS)
    .maybeSingle();
  if (error) throw new Error(`Could not update the invoice: ${error.message}`);
  if (!updated) {
    // Someone else changed it between the read and the write.
    const fresh = await getWireInvoice(invoiceId, client);
    if (fresh?.status === "received") return { invoice: fresh, emailed: false, warning: null };
    throw new Error("The invoice changed while you were marking it. Refresh and try again.");
  }
  const paid = updated as WireInvoiceRow;

  // Activate Premium for the period this wire pays for.
  const months = cycleMonths(paid.billing_cycle);
  const subPatch = {
    plan_type: "founder_premium",
    subscription_status: "active",
    monthly_price_cents: Math.round(paid.amount_cents / months),
    current_period_start: period.start.toISOString(),
    current_period_end: period.end.toISOString(),
    grace_period_ends_at: null,
    updated_at: receivedAt.toISOString(),
  };
  const { data: existing } = await client.from("subscriptions").select("id, ls_subscription_id, subscription_status, plan_type").eq("profile_id", paid.profile_id).maybeSingle();
  const ex = existing as { id: string; ls_subscription_id: string | null; subscription_status: string; plan_type: string } | null;
  if (ex) {
    const { error: subError } = await client.from("subscriptions").update(subPatch).eq("id", ex.id);
    if (subError) throw new Error(`Invoice marked received, but Premium could not be activated: ${subError.message}`);
  } else {
    const { error: subError } = await client.from("subscriptions").insert({ ...subPatch, profile_id: paid.profile_id, role: "founder", currency: "USD" });
    if (subError) throw new Error(`Invoice marked received, but Premium could not be activated: ${subError.message}`);
  }
  const warning = ex?.ls_subscription_id
    ? "This founder still has a Lemon Squeezy subscription on file. Cancel it in Lemon Squeezy so they are not charged twice."
    : null;

  let emailed = false;
  try {
    const contact = await founderContact(paid.profile_id, client);
    const rendered = renderWireReceiptEmail({
      firstName: contact.firstName,
      invoice: paid,
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
      dashboardUrl: absoluteUrl("/founder/dashboard"),
      pdfUrl: absoluteUrl(wirePdfPath(paid.id)),
    });
    emailed = await emailFounder(paid.profile_id, rendered, "wire_receipt", client, staffId);
  } catch (e) {
    console.warn("[billing/wire] receipt email failed", e);
  }

  // First payment only: the welcome letter and the staff "new paying customer"
  // alert, the same pair the Lemon Squeezy webhook sends. Both never throw.
  if (!paid.is_renewal) {
    await sendFounderWelcomeLetter({ founderId: paid.profile_id, plan: "founder_premium", triggeredBy: staffId });
    await alertStaffNewCustomer({ event: "payment", founderId: paid.profile_id, companyId: paid.company_id, plan: "founder_premium" });
  }

  return { invoice: paid, emailed, warning };
}

export async function sendWireReminder(invoiceId: string, staffId: string | null, client: Db = db()): Promise<{ invoice: WireInvoiceRow; emailed: boolean }> {
  const invoice = await getWireInvoice(invoiceId, client);
  if (!invoice) throw new Error("Invoice not found.");
  if (!isOpenStatus(invoice.status)) throw new Error("Only an awaiting or overdue invoice can be reminded.");
  const contact = await founderContact(invoice.profile_id, client);
  const rendered = renderWireReminderEmail({
    firstName: contact.firstName,
    invoice,
    instructions: await getWireInstructions(client),
    billingUrl: absoluteUrl(BILLING_PATH),
    pdfUrl: absoluteUrl(wirePdfPath(invoice.id)),
    overdueDays: daysOverdue(invoice),
  });
  const emailed = await emailFounder(invoice.profile_id, rendered, "wire_reminder", client, staffId);
  if (emailed) {
    await client.from("wire_invoices").update({ reminder_sent_at: new Date().toISOString() }).eq("id", invoiceId);
  }
  return { invoice: { ...invoice, reminder_sent_at: emailed ? new Date().toISOString() : invoice.reminder_sent_at }, emailed };
}

export async function voidWireInvoice(invoiceId: string, staffId: string | null, client: Db = db()): Promise<WireInvoiceRow> {
  const invoice = await getWireInvoice(invoiceId, client);
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "received") throw new Error("A received invoice cannot be voided.");
  if (invoice.status === "void") return invoice;
  const { data, error } = await client
    .from("wire_invoices")
    .update({ status: "void", notes: staffId ? `Voided by staff ${staffId}` : "Voided" })
    .eq("id", invoiceId)
    .select(INVOICE_COLS)
    .single();
  if (error || !data) throw new Error(`Could not void the invoice: ${error?.message ?? "no row returned"}`);
  return data as WireInvoiceRow;
}

// ── Daily cron ───────────────────────────────────────────────────────────────

export type WireCronResult = { markedOverdue: number; renewalsCreated: number; paused: number; errors: string[] };

export async function runWireInvoiceCron(now: Date = new Date(), client: Db = db()): Promise<WireCronResult> {
  const result: WireCronResult = { markedOverdue: 0, renewalsCreated: 0, paused: 0, errors: [] };

  // (a) Awaiting invoices past their due date become overdue.
  {
    const { data, error } = await client
      .from("wire_invoices")
      .update({ status: "overdue" })
      .eq("status", "awaiting")
      .lt("due_at", now.toISOString())
      .select("id");
    if (error) result.errors.push(`overdue: ${error.message}`);
    else result.markedOverdue = (data ?? []).length;
  }

  // (b) Renewal invoices for wire paid Premium subscribers 7 days out.
  {
    const horizon = new Date(now.getTime() + 7 * 86_400_000).toISOString();
    const { data: subs, error } = await client
      .from("subscriptions")
      .select("profile_id, plan_type, subscription_status, current_period_end")
      .eq("plan_type", "founder_premium")
      .eq("subscription_status", "active")
      .lte("current_period_end", horizon);
    if (error) result.errors.push(`renewals: ${error.message}`);
    for (const sub of (subs ?? []) as Array<{ profile_id: string; plan_type: string; subscription_status: string; current_period_end: string | null }>) {
      try {
        const { data: last } = await client
          .from("wire_invoices")
          .select("id, billing_cycle, company_id, status")
          .eq("profile_id", sub.profile_id)
          .neq("status", "void")
          .order("issued_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const lastRow = last as { billing_cycle: WireCycle; company_id: string | null; status: string } | null;
        // Not paid by wire (no invoice on file): nothing to renew here.
        if (!lastRow) continue;
        if (!needsRenewalInvoice(sub, isOpenStatus(lastRow.status), now)) continue;
        const created = await createWireInvoice(
          { profileId: sub.profile_id, companyId: lastRow.company_id, cycle: lastRow.billing_cycle, isRenewal: true, periodStart: sub.current_period_end },
          client,
        );
        if (!created.reused) result.renewalsCreated += 1;
      } catch (e) {
        result.errors.push(`renewal ${sub.profile_id}: ${e instanceof Error ? e.message.slice(0, 160) : "failed"}`);
      }
    }
  }

  // (c) Overdue more than 10 days: pause Premium once the paid period has ended.
  {
    const cutoff = new Date(now.getTime() - 10 * 86_400_000).toISOString();
    const { data: late, error } = await client
      .from("wire_invoices")
      .select(INVOICE_COLS)
      .eq("status", "overdue")
      .lt("due_at", cutoff);
    if (error) result.errors.push(`pause: ${error.message}`);
    for (const inv of (late ?? []) as WireInvoiceRow[]) {
      try {
        const { data: sub } = await client
          .from("subscriptions")
          .select("id, plan_type, subscription_status, current_period_end")
          .eq("profile_id", inv.profile_id)
          .maybeSingle();
        const s = sub as { id: string; plan_type: string; subscription_status: string; current_period_end: string | null } | null;
        if (!shouldPausePremium(inv, s, now) || !s) continue;
        const { error: upErr } = await client
          .from("subscriptions")
          .update({ subscription_status: "expired", updated_at: now.toISOString() })
          .eq("id", s.id)
          .eq("plan_type", "founder_premium");
        if (upErr) {
          result.errors.push(`pause ${inv.profile_id}: ${upErr.message}`);
          continue;
        }
        result.paused += 1;
        const contact = await founderContact(inv.profile_id, client);
        const rendered = renderWirePausedEmail({ firstName: contact.firstName, invoice: inv, billingUrl: absoluteUrl(BILLING_PATH) });
        await emailFounder(inv.profile_id, rendered, "wire_paused", client);
        await createNotification({
          recipientUserId: inv.profile_id,
          type: "billing_wire_paused",
          title: "Premium services paused",
          message: `Invoice ${inv.invoice_number} is overdue. Premium resumes as soon as your wire is received.`,
          entityType: "wire_invoice",
          entityId: inv.id,
          deepLink: BILLING_PATH,
          dedupeKey: `billing_wire_paused:${inv.id}`,
        });
      } catch (e) {
        result.errors.push(`pause ${inv.profile_id}: ${e instanceof Error ? e.message.slice(0, 160) : "failed"}`);
      }
    }
  }

  return result;
}

// ── Founder page data ────────────────────────────────────────────────────────

export type FounderWireState = {
  invoices: WireInvoiceRow[];
  openInvoice: WireInvoiceRow | null;
  instructions: WireInstructions;
  monthlyLabel: string;
  quarterlyLabel: string;
};

/** Everything the billing, upgrade and settings pages need for the wire panel. */
export async function loadFounderWireState(profileId: string): Promise<FounderWireState> {
  const [invoices, instructions, monthly] = await Promise.all([
    listWireInvoicesForProfile(profileId).catch(() => [] as WireInvoiceRow[]),
    getWireInstructions(),
    premiumMonthlyCents(),
  ]);
  const label = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return {
    invoices,
    openInvoice: invoices.find((i) => isOpenStatus(i.status)) ?? null,
    instructions,
    monthlyLabel: label(invoiceAmountCents("monthly", monthly)),
    quarterlyLabel: label(invoiceAmountCents("quarterly", monthly)),
  };
}
