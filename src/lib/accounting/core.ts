/**
 * Accounting app: the pure parts (no database, no env), shared by the server
 * library, the API routes, the PDF, the emails and the client pages.
 * Approved Oct 9, 2026: invoicing first, then A/R, with a read only Bank of
 * America feed through Plaid. No money moves through iCapOS: customers pay by
 * bank transfer and staff confirm the deposit. Every date is Pacific time.
 */

export type EntityId = "icfo_capital_global" | "icfo_venture_group";
export const ENTITIES: Array<{ id: EntityId; name: string; short: string }> = [
  { id: "icfo_capital_global", name: "iCFO Capital Global, Inc.", short: "iCFO Capital Global" },
  { id: "icfo_venture_group", name: "iCFO Venture Group", short: "iCFO Venture Group" },
];
export const DEFAULT_ENTITY: EntityId = "icfo_capital_global";
export const ENTITY_ADDRESS = "La Jolla, CA";

/** Logo and contact lines printed at the top of a company's invoices (Accounting › Settings). */
export type Letterhead = {
  /** PNG or JPEG as a data: URL, or null for no logo. */
  logo: string | null;
  address: string;
  phone: string;
  email: string;
};
export const EMPTY_LETTERHEAD: Letterhead = { logo: null, address: "", phone: "", email: "" };
/** Raw logo file size cap (the data: URL is about a third larger). */
export const LOGO_MAX_BYTES = 1_000_000;

/** A stored or submitted letterhead, cleaned. Throws on a logo that isn't a PNG or JPEG under 1 MB. */
export function normalizeLetterhead(value: unknown): Letterhead {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const s = (k: string, max: number) => (typeof v[k] === "string" ? (v[k] as string).trim().slice(0, max) : "");
  let logo: string | null = null;
  if (typeof v.logo === "string" && v.logo) {
    const m = v.logo.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new Error("The logo must be a PNG or JPG image.");
    if (Math.floor((m[2].length * 3) / 4) > LOGO_MAX_BYTES) throw new Error("The logo is over 1 MB. Use a smaller image.");
    logo = v.logo;
  }
  return { logo, address: s("address", 400), phone: s("phone", 60), email: s("email", 254) };
}

/** Address, phone and email as printed lines; falls back to the city when nothing is saved. */
export function letterheadLines(l: Letterhead): string[] {
  const lines = l.address ? l.address.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : [ENTITY_ADDRESS];
  const contact = [l.phone, l.email].filter(Boolean).join(" · ");
  return contact ? [...lines, contact] : lines;
}

/** The disclaimer line, naming the company that issued the invoice. */
export function entityDisclaimer(entity: string): string {
  const who = entity === "icfo_venture_group" ? "iCFO Venture Group" : "iCFO Capital";
  return `${who} does not solicit securities and is not an investment adviser.`;
}

export function isEntity(v: unknown): v is EntityId {
  return v === "icfo_capital_global" || v === "icfo_venture_group";
}
export function entityName(id: string): string {
  return ENTITIES.find((e) => e.id === id)?.name ?? ENTITIES[0].name;
}

export type InvoiceStatus = "draft" | "scheduled" | "sent" | "paid" | "void";
/** What a person sees: stored status plus the two worked out ones. */
export type DisplayStatus = InvoiceStatus | "overdue" | "partial";

export type Customer = {
  id: string;
  entity: EntityId;
  contact_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  crm_contact_id: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
};

export type InvoiceLine = {
  id?: string;
  position: number;
  description: string;
  quantity: number;
  unit_cents: number;
  amount_cents: number;
};

export type Invoice = {
  id: string;
  entity: EntityId;
  invoice_number: string;
  customer_id: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  total_cents: number;
  amount_paid_cents: number;
  memo: string | null;
  series_id: string | null;
  series_index: number | null;
  series_count: number | null;
  public_token: string;
  sent_at: string | null;
  last_emailed_to: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
  /** When the customer pressed "I've sent the payment" on the pay page (migration 20261010120000). */
  client_reported_paid_at?: string | null;
};

export type Payment = {
  id: string;
  invoice_id: string;
  amount_cents: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string | null;
  bank_transaction_id: string | null;
  created_at: string;
};

export type PaymentMethod = "ach" | "wire" | "check" | "card" | "other";
export const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string }> = [
  { id: "ach", label: "ACH" },
  { id: "wire", label: "Wire" },
  { id: "check", label: "Check" },
  { id: "card", label: "Card" },
  { id: "other", label: "Other" },
];
export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return PAYMENT_METHODS.some((m) => m.id === v);
}

export type BankTxStatus = "review" | "matched" | "categorized" | "ignored";
export type BankTransaction = {
  id: string;
  account_id: string;
  source: "plaid" | "import";
  external_id: string;
  posted_on: string;
  description: string;
  merchant: string | null;
  amount_cents: number;
  pending: boolean;
  status: BankTxStatus;
  category: string | null;
  matched_invoice_id: string | null;
};

/** Categories for money out (and money in that is not an invoice payment). Feeds the P&L later. */
export const EXPENSE_CATEGORIES = [
  "Software", "Payroll and contractors", "Professional fees", "Marketing", "Travel and meals",
  "Rent and office", "Bank fees", "Taxes", "Owner draw or transfer", "Other expense", "Other income",
] as const;

// ── Money ────────────────────────────────────────────────────────────────────

export function money(cents: number, currency = "USD"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents) / 100;
  const body = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "USD" ? `${sign}$${body}` : `${sign}${body} ${currency}`;
}

/** "2,000" or "$2,000.50" typed by a person, to cents. Null when not a number. */
export function parseMoneyToCents(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  if (typeof input !== "string") return null;
  const clean = input.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export function lineAmount(quantity: number, unitCents: number): number {
  return Math.round(quantity * unitCents);
}

export function invoiceTotal(lines: Array<Pick<InvoiceLine, "amount_cents">>): number {
  return lines.reduce((s, l) => s + l.amount_cents, 0);
}

export function balanceDue(inv: Pick<Invoice, "total_cents" | "amount_paid_cents" | "status">): number {
  if (inv.status === "void") return 0;
  return Math.max(0, inv.total_cents - inv.amount_paid_cents);
}

// ── Dates (Pacific time, stored as YYYY-MM-DD) ───────────────────────────────

const PT = "America/Los_Angeles";

/** Today's date in PT as YYYY-MM-DD. */
export function todayPT(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: PT, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole calendar months, clamped to month end (Jan 31 + 1 = Feb 28 or 29). */
export function addMonthsDate(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

/** "Dec 1, 2026" for a YYYY-MM-DD date. */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return "Not set";
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
}

/** "Dec 1, 2026, 6:00 AM PT" for a timestamp. */
export function fmtStampPT(iso: string | null | undefined): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: PT }).format(new Date(iso)) + " PT";
}

// ── Status ───────────────────────────────────────────────────────────────────

export function displayStatus(inv: Pick<Invoice, "status" | "due_date" | "total_cents" | "amount_paid_cents">, today: string = todayPT()): DisplayStatus {
  if (inv.status !== "sent") return inv.status;
  if (inv.due_date < today) return "overdue";
  if (inv.amount_paid_cents > 0 && inv.amount_paid_cents < inv.total_cents) return "partial";
  return "sent";
}

export function isOpen(inv: Pick<Invoice, "status">): boolean {
  return inv.status === "sent";
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sent: "Sent",
  partial: "Partly paid",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

export type Tone = "ok" | "warn" | "bad" | "info" | "pro" | "mute";
export const STATUS_TONE: Record<DisplayStatus, Tone> = {
  draft: "mute",
  scheduled: "pro",
  sent: "info",
  partial: "warn",
  overdue: "bad",
  paid: "ok",
  void: "mute",
};

// ── Monthly series ───────────────────────────────────────────────────────────

/** Issue and due dates for a monthly series of `count` invoices starting `start`. */
export function seriesDates(start: string, count: number, dueDays: number): Array<{ issue_date: string; due_date: string }> {
  const n = Math.max(1, Math.min(36, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => {
    const issue = addMonthsDate(start, i);
    return { issue_date: issue, due_date: addDays(issue, dueDays) };
  });
}

/** "Advisory services, month 2 of 4". */
export function seriesLineLabel(description: string, index: number, count: number): string {
  return count > 1 ? `${description.trim()}, month ${index} of ${count}` : description.trim();
}

// ── A/R aging ────────────────────────────────────────────────────────────────

export const AGING_BUCKETS = ["Current", "1 to 30", "31 to 60", "61 to 90", "Over 90"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingBucket(dueDate: string, today: string = todayPT()): AgingBucket {
  const late = daysBetween(dueDate, today);
  if (late <= 0) return "Current";
  if (late <= 30) return "1 to 30";
  if (late <= 60) return "31 to 60";
  if (late <= 90) return "61 to 90";
  return "Over 90";
}

export type AgingRow = { customerId: string; customer: string; buckets: Record<AgingBucket, number>; total: number };

export function agingReport(
  invoices: Array<Pick<Invoice, "customer_id" | "status" | "due_date" | "total_cents" | "amount_paid_cents">>,
  customerName: (id: string) => string,
  today: string = todayPT(),
): { rows: AgingRow[]; totals: Record<AgingBucket, number>; total: number } {
  const byCustomer = new Map<string, AgingRow>();
  const empty = (): Record<AgingBucket, number> => ({ "Current": 0, "1 to 30": 0, "31 to 60": 0, "61 to 90": 0, "Over 90": 0 });
  const totals = empty();
  let total = 0;
  for (const inv of invoices) {
    if (!isOpen(inv)) continue;
    const due = balanceDue(inv);
    if (due <= 0) continue;
    const b = agingBucket(inv.due_date, today);
    const row = byCustomer.get(inv.customer_id) ?? { customerId: inv.customer_id, customer: customerName(inv.customer_id), buckets: empty(), total: 0 };
    row.buckets[b] += due;
    row.total += due;
    byCustomer.set(inv.customer_id, row);
    totals[b] += due;
    total += due;
  }
  return { rows: [...byCustomer.values()].sort((a, b) => b.total - a.total), totals, total };
}

// ── Bank matching ────────────────────────────────────────────────────────────

/** Plaid reports money out as positive. iCapOS stores money in as positive. */
export function plaidAmountToCents(plaidAmount: number): number {
  return -Math.round(plaidAmount * 100);
}

function compact(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type MatchCandidate = Pick<Invoice, "id" | "invoice_number" | "customer_id" | "status" | "due_date" | "total_cents" | "amount_paid_cents">
  & Partial<Pick<Invoice, "entity" | "issue_date">> & { customerLabel?: string | null };

/** The deposit side of a match. posted_on and entity (the receiving account's company) narrow the candidates when known. */
export type MatchDeposit = Pick<BankTransaction, "amount_cents" | "description" | "merchant"> & { posted_on?: string; entity?: EntityId | null };

/**
 * An invoice can only be paid by a deposit into an account of the company that
 * billed it, dated on or after the invoice was issued. Older deposits and
 * transfers into another company's account are never offered.
 */
export function canPay(tx: MatchDeposit, inv: MatchCandidate): boolean {
  if (tx.entity && inv.entity && tx.entity !== inv.entity) return false;
  if (tx.posted_on && inv.issue_date && tx.posted_on < inv.issue_date) return false;
  return true;
}

/**
 * The open invoice a deposit most likely pays. Only money in is matched, and
 * only for the exact balance due. The invoice number in the description wins;
 * otherwise the customer's name; otherwise a single invoice with that balance.
 * Returns null when the choice is not clear, so a person decides.
 */
export function suggestMatch(
  tx: MatchDeposit,
  invoices: MatchCandidate[],
): MatchCandidate | null {
  if (tx.amount_cents <= 0) return null;
  const text = compact(`${tx.description} ${tx.merchant ?? ""}`);
  const open = invoices.filter((i) => isOpen(i) && balanceDue(i) === tx.amount_cents && canPay(tx, i));
  if (open.length === 0) return null;
  const byNumber = open.filter((i) => text.includes(compact(i.invoice_number)));
  if (byNumber.length === 1) return byNumber[0];
  const byName = open.filter((i) => {
    const label = compact(i.customerLabel ?? "");
    return label.length >= 4 && text.includes(label);
  });
  if (byName.length >= 1) return [...byName].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  return open.length === 1 ? open[0] : null;
}

/**
 * A deposit the bank feed can mark paid without a person: money in, exactly
 * the balance due, and the invoice number in the description. Anything less
 * certain stays a suggestion for staff to confirm.
 */
export function autoMatch(
  tx: MatchDeposit,
  invoices: MatchCandidate[],
): MatchCandidate | null {
  if (tx.amount_cents <= 0) return null;
  const text = compact(`${tx.description} ${tx.merchant ?? ""}`);
  const hits = invoices.filter((i) => isOpen(i) && balanceDue(i) === tx.amount_cents && canPay(tx, i) && text.includes(compact(i.invoice_number)));
  return hits.length === 1 ? hits[0] : null;
}

/** The customer's pay page for an invoice (no account needed; the token is the key). */
export function payPagePath(inv: Pick<Invoice, "invoice_number" | "public_token">): string {
  return `/pay/${encodeURIComponent(inv.invoice_number.toLowerCase())}?t=${inv.public_token}`;
}

// ── Bank file imports (Bank of America CSV and QFX / OFX) ────────────────────

export type ImportedTx = { external_id: string; posted_on: string; description: string; amount_cents: number };

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function usDate(v: string): string | null {
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : null;
  }
  return isIsoDate(v) ? v : null;
}

/** Stable id for a file row so importing the same file twice adds nothing. */
function importId(date: string, desc: string, cents: number, seq: number): string {
  let h = 2166136261;
  const s = `${date}|${desc}|${cents}|${seq}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `csv-${(h >>> 0).toString(16)}`;
}

/**
 * Bank of America CSV (Date, Description, Amount, Running Bal.), with any
 * summary lines above the header skipped. Also reads Debit / Credit columns.
 */
export function parseBankCsv(text: string): ImportedTx[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  const headerIdx = lines.findIndex((l) => /(^|,)"?date"?\s*,/i.test(l) && /description|payee|memo/i.test(l));
  if (headerIdx < 0) return [];
  const header = splitCsvLine(lines[headerIdx]).map((h) => h.toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.startsWith(n)));
  const iDate = col("date", "posted");
  const iDesc = col("description", "payee", "memo");
  const iAmt = col("amount");
  const iDebit = col("debit", "withdrawal");
  const iCredit = col("credit", "deposit");
  const seen = new Map<string, number>();
  const out: ImportedTx[] = [];
  for (const line of lines.slice(headerIdx + 1)) {
    const cells = splitCsvLine(line);
    const date = usDate(cells[iDate] ?? "");
    const desc = (cells[iDesc] ?? "").trim();
    if (!date || !desc) continue;
    let cents: number | null = null;
    if (iAmt >= 0) cents = parseMoneyToCents(cells[iAmt] ?? "");
    else {
      const debit = parseMoneyToCents(cells[iDebit] ?? "") ?? 0;
      const credit = parseMoneyToCents(cells[iCredit] ?? "") ?? 0;
      cents = credit - Math.abs(debit);
    }
    if (cents === null || cents === 0) continue;
    const key = `${date}|${desc}|${cents}`;
    const seq = (seen.get(key) ?? 0) + 1;
    seen.set(key, seq);
    out.push({ external_id: importId(date, desc, cents, seq), posted_on: date, description: desc.slice(0, 300), amount_cents: cents });
  }
  return out;
}

/** QFX / OFX STMTTRN blocks (SGML or XML style). FITID is the bank's own id. */
export function parseOfx(text: string): ImportedTx[] {
  const out: ImportedTx[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
  for (const b of blocks) {
    const raw = tag(b, "DTPOSTED");
    const date = raw.length >= 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : "";
    const cents = parseMoneyToCents(tag(b, "TRNAMT"));
    const desc = [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" ").trim();
    const fitid = tag(b, "FITID");
    if (!isIsoDate(date) || cents === null || cents === 0 || !desc) continue;
    out.push({ external_id: fitid ? `ofx-${fitid}` : importId(date, desc, cents, 1), posted_on: date, description: desc.slice(0, 300), amount_cents: cents });
  }
  return out;
}

export function parseBankFile(text: string): ImportedTx[] {
  return /<STMTTRN>/i.test(text) ? parseOfx(text) : parseBankCsv(text);
}

// ── Copy ─────────────────────────────────────────────────────────────────────

export const ACCOUNTING_COPY = {
  payNote: "Pay by bank transfer (ACH or wire). Include the invoice number as the reference so we can match your payment.",
  noInstructions: "Bank transfer details are on their way from our team by email.",
  footer: "Thank you for your business.",
  disclaimer: "iCFO Capital does not solicit securities and is not an investment adviser.",
} as const;
