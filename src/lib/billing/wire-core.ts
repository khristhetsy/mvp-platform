/**
 * Premium by bank wire: the pure parts (no database, no env), shared by the
 * server library (wire.ts), the cron, the API routes, the PDF and the client
 * panels. Approved Oct 9, 2026: Premium is paid ONLY by wire, monthly ($1,000)
 * or quarterly ($3,000, no discount). Basic and Professional stay on Lemon
 * Squeezy.
 */

export type WireCycle = "monthly" | "quarterly";
export type WireStatus = "awaiting" | "received" | "overdue" | "void";

export const WIRE_CYCLES: readonly WireCycle[] = ["monthly", "quarterly"] as const;

/** Premium monthly price in cents when the pricing catalogue can't be read. */
export const PREMIUM_MONTHLY_CENTS = 100000;

/** Days from issue to due date. */
export const WIRE_DUE_DAYS = 7;
/** A renewal invoice is created this many days before the period ends. */
export const WIRE_RENEWAL_LEAD_DAYS = 7;
/** Overdue longer than this pauses Premium services (once the period has ended). */
export const WIRE_PAUSE_AFTER_DAYS = 10;

const DAY_MS = 86_400_000;

export type WireInvoiceLike = {
  status: WireStatus | string;
  due_at: string;
};

export type WireInvoiceRow = {
  id: string;
  invoice_number: string;
  profile_id: string;
  company_id: string | null;
  plan_type: string;
  billing_cycle: WireCycle;
  amount_cents: number;
  currency: string;
  status: WireStatus;
  issued_at: string;
  due_at: string;
  period_start: string | null;
  period_end: string | null;
  received_at: string | null;
  received_by: string | null;
  reminder_sent_at: string | null;
  is_renewal: boolean;
  notes: string | null;
  created_at: string;
};

export type WireInstructions = {
  beneficiary: string;
  bank_name: string;
  routing_number: string;
  swift: string;
  account_number: string;
  bank_address: string;
  notes: string;
};

export const DEFAULT_BENEFICIARY = "iCFO Capital Global, Inc.";

/** Never pre-filled with real account numbers: staff enter them in Admin, Billing. */
export const EMPTY_WIRE_INSTRUCTIONS: WireInstructions = {
  beneficiary: DEFAULT_BENEFICIARY,
  bank_name: "",
  routing_number: "",
  swift: "",
  account_number: "",
  bank_address: "",
  notes: "",
};

export const WIRE_INSTRUCTION_FIELDS: Array<{ key: keyof WireInstructions; label: string }> = [
  { key: "beneficiary", label: "Beneficiary" },
  { key: "bank_name", label: "Bank name" },
  { key: "routing_number", label: "Routing number (ABA)" },
  { key: "swift", label: "SWIFT / BIC" },
  { key: "account_number", label: "Account number" },
  { key: "bank_address", label: "Bank address" },
  { key: "notes", label: "Notes" },
];

/** Clean a stored or submitted value into the full shape (trimmed, length capped). */
export function normalizeWireInstructions(value: unknown): WireInstructions {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const str = (k: keyof WireInstructions, max = 200) => (typeof v[k] === "string" ? (v[k] as string).trim().slice(0, max) : "");
  return {
    beneficiary: str("beneficiary") || DEFAULT_BENEFICIARY,
    bank_name: str("bank_name"),
    routing_number: str("routing_number", 40),
    swift: str("swift", 40),
    account_number: str("account_number", 60),
    bank_address: str("bank_address", 300),
    notes: str("notes", 600),
  };
}

/** The bank details a founder needs before an invoice is useful. */
export function wireInstructionsComplete(i: WireInstructions): boolean {
  return Boolean(i.beneficiary && i.bank_name && i.account_number && (i.routing_number || i.swift));
}

/** Rows to print on an invoice, email or PDF (empty fields left out). */
export function wireInstructionRows(i: WireInstructions): Array<{ label: string; value: string }> {
  return WIRE_INSTRUCTION_FIELDS.map((f) => ({ label: f.label, value: i[f.key] })).filter((r) => r.value.trim().length > 0);
}

export function cycleMonths(cycle: WireCycle): number {
  return cycle === "quarterly" ? 3 : 1;
}

export function isWireCycle(value: unknown): value is WireCycle {
  return value === "monthly" || value === "quarterly";
}

/** Monthly $1,000 or quarterly $3,000 (three months, no discount). */
export function invoiceAmountCents(cycle: WireCycle, monthlyCents: number = PREMIUM_MONTHLY_CENTS): number {
  return monthlyCents * cycleMonths(cycle);
}

/**
 * Add whole calendar months in UTC, clamping to the last day of the target
 * month (Jan 31 + 1 month = Feb 28 or 29), so a period never skips a month.
 */
export function addMonths(start: Date, months: number): Date {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDay);
  return new Date(Date.UTC(y, m, day, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()));
}

export function periodEnd(start: Date | string, cycle: WireCycle): Date {
  return addMonths(new Date(start), cycleMonths(cycle));
}

export function dueDateFor(issued: Date | string): Date {
  return new Date(new Date(issued).getTime() + WIRE_DUE_DAYS * DAY_MS);
}

/** Whole days past the due date; 0 when not yet due, received or void. */
export function daysOverdue(invoice: WireInvoiceLike, now: Date = new Date()): number {
  if (invoice.status === "received" || invoice.status === "void") return 0;
  const diff = now.getTime() - new Date(invoice.due_at).getTime();
  return diff > 0 ? Math.floor(diff / DAY_MS) : 0;
}

/** "awaiting" turns "overdue" once the due date passes; received and void stay put. */
export function statusFor(invoice: WireInvoiceLike, now: Date = new Date()): WireStatus {
  if (invoice.status === "received" || invoice.status === "void") return invoice.status;
  return now.getTime() > new Date(invoice.due_at).getTime() ? "overdue" : "awaiting";
}

export function isOpenStatus(status: string): boolean {
  return status === "awaiting" || status === "overdue";
}

/** A wire paid Premium subscriber needs a renewal invoice now. */
export function needsRenewalInvoice(
  sub: { plan_type: string; subscription_status: string; current_period_end: string | null },
  hasOpenInvoice: boolean,
  now: Date = new Date(),
): boolean {
  if (sub.plan_type !== "founder_premium" || sub.subscription_status !== "active") return false;
  if (hasOpenInvoice || !sub.current_period_end) return false;
  return new Date(sub.current_period_end).getTime() - now.getTime() <= WIRE_RENEWAL_LEAD_DAYS * DAY_MS;
}

/**
 * Overdue past 10 days pauses Premium, but only while the founder is still on
 * Premium, still active, and the paid period has actually ended.
 */
export function shouldPausePremium(
  invoice: WireInvoiceLike,
  sub: { plan_type: string; subscription_status: string; current_period_end: string | null } | null,
  now: Date = new Date(),
): boolean {
  if (!sub || sub.plan_type !== "founder_premium" || sub.subscription_status !== "active") return false;
  if (daysOverdue(invoice, now) <= WIRE_PAUSE_AFTER_DAYS) return false;
  if (!sub.current_period_end) return true;
  return new Date(sub.current_period_end).getTime() <= now.getTime();
}

/**
 * The period a payment buys. A renewal continues from the period it renews. A
 * first invoice paid after its planned start begins on the day the wire arrived,
 * so the founder never pays for days before Premium was on.
 */
export function activationPeriod(
  invoice: { billing_cycle: WireCycle; period_start: string | null; is_renewal: boolean; issued_at: string },
  receivedAt: Date,
): { start: Date; end: Date } {
  const planned = new Date(invoice.period_start ?? invoice.issued_at);
  const start = !invoice.is_renewal && receivedAt.getTime() > planned.getTime() ? receivedAt : planned;
  return { start, end: periodEnd(start, invoice.billing_cycle) };
}

export const WIRE_STATUS_LABEL: Record<WireStatus, string> = {
  awaiting: "Awaiting",
  received: "Received",
  overdue: "Overdue",
  void: "Void",
};

/** Pill colours: Awaiting amber, Received green, Overdue red, Void gray. */
export const WIRE_STATUS_TONE: Record<WireStatus, { bg: string; fg: string }> = {
  awaiting: { bg: "#FAEEDA", fg: "#854F0B" },
  received: { bg: "#E1F5EE", fg: "#0F6E56" },
  overdue: { bg: "#FCEBEB", fg: "#A32D2D" },
  void: { bg: "#F1EFE8", fg: "#5F5E5A" },
};

export const WIRE_CYCLE_LABEL: Record<WireCycle, string> = { monthly: "Monthly", quarterly: "Quarterly" };

export function wireMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "Oct 9, 2026" in Pacific time. */
export function wireDatePT(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(iso)) + " PT";
}

// ── Copy shared by the panel, the email and the PDF ──────────────────────────
export const WIRE_COPY = {
  panelTitle: "Premium, $1,000/mo. We do the heavy lifting so you can close the deal.",
  paymentMethod: "Bank wire transfer",
  emailNote: "We email an invoice with wire instructions. Premium activates as soon as your wire is received, usually within 1 to 2 business days.",
  flatFee: "Flat monthly fee. Fees are never tied to funding outcomes.",
  reference: "Include the reference so we can match your payment. Sender pays wire fees.",
  disclaimer: "iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.",
  adminExplainer: "Marking received activates Premium and sends the founder a receipt. Next invoice is created automatically 7 days before renewal. Overdue past 10 days pauses Premium services.",
} as const;
