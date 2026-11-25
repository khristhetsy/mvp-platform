// Department dashboard data: one list of metrics per department (Sales, Marketing,
// Customer Support, Administration), each with a real week / month / year comparison.
//
// The comparison is a FLOW comparison: how many rows were created (or reached a
// state) in the last N days against the N days before that. A stock figure such as
// "open requests today" has no history in the database, so it never gets an invented
// percentage; its change line says what the flow did, and only where a timestamp
// column exists to measure it.

import type { SupabaseClient } from "@supabase/supabase-js";

export const PERIODS = ["week", "month", "year"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<Period, string> = { week: "week", month: "month", year: "year" };
export const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, year: 365 };

export type DepartmentId = "sales" | "marketing" | "support" | "administration";
export const DEPARTMENT_ORDER: readonly DepartmentId[] = ["sales", "marketing", "support", "administration"];
export const DEPARTMENT_NAME: Record<DepartmentId, string> = {
  sales: "Sales",
  marketing: "Marketing",
  support: "Customer Support",
  administration: "Administration",
};

const DAY_MS = 86_400_000;
/** Two years of history is enough for the year comparison (this year against the one before). */
const HISTORY_DAYS = 2 * 365;
const ROW_LIMIT = 5000;

export type PeriodChange = {
  current: number;
  prior: number;
  delta: number;
  /** Null when the prior period had none: a percentage of zero is undefined, not 100%. */
  percent: number | null;
  direction: "up" | "down" | "flat";
};

/** Rolling windows ending at `now`: current is the last N days, prior the N days before. */
export function periodWindow(nowMs: number, period: Period) {
  const span = PERIOD_DAYS[period] * DAY_MS;
  return { currentFrom: nowMs - span, priorFrom: nowMs - 2 * span, now: nowMs };
}

export function computeChange(current: number, prior: number): PeriodChange {
  const delta = current - prior;
  const percent = prior > 0 ? Math.round((delta / prior) * 1000) / 10 : null;
  return { current, prior, delta, percent, direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat" };
}

/** Counts timestamps in the current and prior window for one period. */
export function changeForPeriod(stamps: readonly number[], nowMs: number, period: Period): PeriodChange {
  const w = periodWindow(nowMs, period);
  let current = 0;
  let prior = 0;
  for (const t of stamps) {
    if (t > w.currentFrom && t <= w.now) current += 1;
    else if (t > w.priorFrom && t <= w.currentFrom) prior += 1;
  }
  return computeChange(current, prior);
}

/** Twelve weekly buckets, oldest first; the last bucket is the most recent 7 days. */
export function weeklyBuckets(stamps: readonly number[], nowMs: number, weeks = 12): number[] {
  const out = Array.from({ length: weeks }, () => 0);
  const span = 7 * DAY_MS;
  for (const t of stamps) {
    const age = nowMs - t;
    if (age < 0 || age >= weeks * span) continue;
    out[weeks - 1 - Math.floor(age / span)] += 1;
  }
  return out;
}

export type DepartmentMetric = {
  id: string;
  department: DepartmentId;
  label: string;
  /** Today's figure. */
  value: number;
  /** What the value counts, shown under the label. */
  detail: string;
  /** What the week / month / year comparison counts, e.g. "new companies". */
  flowLabel: string | null;
  /** True when a higher number is the worse outcome, so an up arrow reads as bad. */
  higherIsWorse?: boolean;
  /** True when this figure is work waiting for a person: it feeds "open items". */
  openItem?: boolean;
  href?: string;
  /** Null when no timestamp column measures the flow. */
  /** Periods missing from the record are not measurable for this metric. */
  changes: Partial<Record<Period, PeriodChange>> | null;
  weekly: number[] | null;
  /** Replaces the plain count in the tile, e.g. "4.2h" or "$38 of $100". */
  valueText?: string;
  /** Fill for the ring, 0 to 100. Only set when a real denominator exists. */
  percent?: number | null;
  /** What the number counts, shown in the detail popup. */
  definition?: string;
  /** Table or view the number is read from. */
  source?: string;
  /** Set when the history query failed or hit the row limit. */
  note?: string;
};

type Db = SupabaseClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Filter = (q: any) => any;

type Spec = {
  id: string;
  department: DepartmentId;
  label: string;
  detail: string;
  table: string;
  /** Applied to the stock count query. */
  stock: Filter;
  /** Timestamp column that measures the flow, or null when there is none. */
  flowColumn: string | null;
  flowFilter?: Filter;
  flowLabel?: string;
  higherIsWorse?: boolean;
  openItem?: boolean;
  href?: string;
};

const none: Filter = (q) => q;

/** The metric list. Adding a tile is adding a row here. */
export function departmentSpecs(nowIso: string): Spec[] {
  return [
    // Sales
    {
      id: "sales_active_raises", department: "sales", label: "Active raises", table: "companies",
      detail: "Published marketplace listings",
      stock: (q) => q.eq("review_status", "approved").eq("is_published", true).eq("marketplace_visible", true).not("published_at", "is", null),
      flowColumn: "published_at",
      flowFilter: (q) => q.eq("review_status", "approved").eq("is_published", true).eq("marketplace_visible", true),
      flowLabel: "newly published", href: "/admin/marketplace",
    },
    { id: "sales_companies", department: "sales", label: "Companies", table: "companies", detail: "Founder companies on the platform", stock: none, flowColumn: "created_at", flowLabel: "new companies", href: "/admin/companies" },
    { id: "sales_investors", department: "sales", label: "Investors", table: "profiles", detail: "Investor accounts", stock: (q) => q.ilike("role", "investor"), flowColumn: "created_at", flowFilter: (q) => q.ilike("role", "investor"), flowLabel: "new investors", href: "/admin/investors" },
    { id: "sales_pending_reviews", department: "sales", label: "Companies awaiting review", table: "companies", detail: "Waiting for institutional review", stock: (q) => q.eq("review_status", "pending"), flowColumn: null, openItem: true, higherIsWorse: true, href: "/admin/companies" },
    // Marketing
    { id: "marketing_contacts", department: "marketing", label: "Marketing contacts", table: "marketing_contacts", detail: "Contacts available to campaigns", stock: none, flowColumn: "created_at", flowLabel: "new contacts", href: "/admin/marketing/contacts" },
    { id: "marketing_sent", department: "marketing", label: "Emails sent", table: "marketing_events", detail: "All send events recorded", stock: (q) => q.eq("event_type", "sent"), flowColumn: "occurred_at", flowFilter: (q) => q.eq("event_type", "sent"), flowLabel: "emails sent", href: "/admin/marketing/analytics" },
    { id: "marketing_opened", department: "marketing", label: "Emails opened", table: "marketing_events", detail: "All open events recorded", stock: (q) => q.eq("event_type", "opened"), flowColumn: "occurred_at", flowFilter: (q) => q.eq("event_type", "opened"), flowLabel: "opens", href: "/admin/marketing/analytics" },
    { id: "marketing_clicked", department: "marketing", label: "Email clicks", table: "marketing_events", detail: "All click events recorded", stock: (q) => q.eq("event_type", "clicked"), flowColumn: "occurred_at", flowFilter: (q) => q.eq("event_type", "clicked"), flowLabel: "clicks", href: "/admin/marketing/analytics" },
    // Customer Support
    { id: "support_open", department: "support", label: "Open requests", table: "support_requests", detail: "Open or waiting on the requester", stock: (q) => q.in("status", ["open", "pending_founder"]), flowColumn: "created_at", flowLabel: "new requests", openItem: true, higherIsWorse: true, href: "/admin/support" },
    { id: "support_overdue", department: "support", label: "Past due date", table: "support_requests", detail: "Unresolved and past their due date", stock: (q) => q.in("status", ["open", "pending_founder"]).lt("due_at", nowIso), flowColumn: null, higherIsWorse: true, href: "/admin/support" },
    { id: "support_resolved", department: "support", label: "Resolved requests", table: "support_requests", detail: "All resolved requests", stock: (q) => q.eq("status", "resolved"), flowColumn: "resolved_at", flowFilter: (q) => q.eq("status", "resolved"), flowLabel: "resolved", href: "/admin/support" },
    // Administration
    { id: "admin_compliance", department: "administration", label: "Open compliance events", table: "compliance_events", detail: "Open compliance queue items", stock: (q) => q.eq("status", "open"), flowColumn: "created_at", flowLabel: "new events", higherIsWorse: true, openItem: true, href: "/admin/compliance" },
    { id: "admin_spv", department: "administration", label: "SPV pipeline", table: "spv_opportunities", detail: "SPV opportunities not yet closed", stock: (q) => q.neq("status", "closed"), flowColumn: "created_at", flowLabel: "new SPV opportunities", href: "/admin/spvs" },
    { id: "admin_investor_approvals", department: "administration", label: "Investor approvals pending", table: "investor_profiles", detail: "Waiting for approval", stock: (q) => q.eq("approval_status", "pending"), flowColumn: null, openItem: true, higherIsWorse: true, href: "/admin/investors" },
    { id: "admin_upgrades", department: "administration", label: "Upgrade requests", table: "upgrade_requests", detail: "Pending billing upgrade requests", stock: (q) => q.eq("status", "pending"), flowColumn: "created_at", flowLabel: "new requests", openItem: true, higherIsWorse: true, href: "/admin/billing" },
    // Sales extras
    { id: "sales_trials", department: "sales", label: "Trials", table: "subscriptions", detail: "Accounts in a trial", stock: (q) => q.eq("subscription_status", "trialing"), flowColumn: "trial_started_at", flowFilter: (q) => q.eq("subscription_status", "trialing"), flowLabel: "new trials", href: "/admin/billing" },
    { id: "sales_paying", department: "sales", label: "Paying plans", table: "subscriptions", detail: "Active subscriptions", stock: (q) => q.eq("subscription_status", "active"), flowColumn: "created_at", flowFilter: (q) => q.eq("subscription_status", "active"), flowLabel: "new active plans", href: "/admin/billing" },
    { id: "sales_demos", department: "sales", label: "Demo requests", table: "marketing_site_demo_bookings", detail: "Demo requests from the website", stock: none, flowColumn: "created_at", flowLabel: "demo requests", href: "/admin/sales/bookings" },
    // Marketing extras
    { id: "marketing_campaigns_sent", department: "marketing", label: "Campaigns sent", table: "marketing_campaigns", detail: "Campaigns with a send date", stock: (q) => q.not("sent_at", "is", null), flowColumn: "sent_at", flowFilter: (q) => q.not("sent_at", "is", null), flowLabel: "campaigns sent", href: "/admin/marketing/campaigns" },
    { id: "marketing_unsubscribes", department: "marketing", label: "Unsubscribes", table: "marketing_unsubscribes", detail: "Contacts who unsubscribed", stock: none, flowColumn: "unsubscribed_at", flowLabel: "unsubscribes", higherIsWorse: true, href: "/admin/marketing/suppressions" },
    { id: "marketing_feedback", department: "marketing", label: "Beta feedback", table: "beta_feedback", detail: "Feedback submitted by beta users", stock: none, flowColumn: "created_at", flowLabel: "feedback items", href: "/admin/beta-operations" },
    // Support extras
    { id: "support_reopened", department: "support", label: "Reopened", table: "support_requests", detail: "Requests reopened at least once", stock: (q) => q.gt("reopened_count", 0), flowColumn: null, higherIsWorse: true, href: "/admin/support" },
    // Administration extras
    { id: "admin_interest", department: "administration", label: "Indications of interest", table: "investor_interests", detail: "Investor indications of interest", stock: none, flowColumn: "created_at", flowLabel: "new indications", href: "/admin/investors" },
    { id: "admin_intros", department: "administration", label: "Intro requests pending", table: "intro_requests", detail: "Requested or under review", stock: (q) => q.in("status", ["requested", "reviewing"]), flowColumn: "created_at", flowLabel: "new intro requests", openItem: true, higherIsWorse: true, href: "/admin/intro-requests" },
    { id: "admin_kyc", department: "administration", label: "KYC to review", table: "investor_profiles", detail: "Investor KYC marked pending", stock: (q) => q.eq("kyc_status", "pending"), flowColumn: null, openItem: true, higherIsWorse: true, href: "/admin/investors" },
    { id: "admin_invoices", department: "administration", label: "Open invoices", table: "acct_invoices", detail: "Sent and not yet paid", stock: (q) => q.eq("status", "sent"), flowColumn: "created_at", flowFilter: (q) => q.eq("status", "sent"), flowLabel: "invoices created", higherIsWorse: true, href: "/admin/accounting" },
    { id: "admin_unapplied", department: "administration", label: "Unapplied payments", table: "acct_payments", detail: "Payments not matched to an invoice", stock: (q) => q.is("invoice_id", null), flowColumn: "created_at", flowFilter: (q) => q.is("invoice_id", null), flowLabel: "unapplied payments", openItem: true, higherIsWorse: true, href: "/admin/accounting" },
    { id: "admin_scores", department: "administration", label: "Readiness scores", table: "company_readiness_scores", detail: "Capital Readiness Rating scores recorded", stock: none, flowColumn: "created_at", flowLabel: "new scores", href: "/admin/readiness" },
  ];
}

async function loadOne(db: Db, spec: Spec, nowMs: number): Promise<DepartmentMetric> {
  const base = {
    id: spec.id,
    department: spec.department,
    label: spec.label,
    detail: spec.detail,
    flowLabel: spec.flowColumn ? spec.flowLabel ?? null : null,
    higherIsWorse: spec.higherIsWorse,
    openItem: spec.openItem,
    href: spec.href,
    source: spec.table,
    definition: spec.detail,
  };

  const stock = await spec.stock(db.from(spec.table).select("id", { count: "exact", head: true }));
  if (stock.error) {
    return { ...base, value: 0, changes: null, weekly: null, note: "Not available: the count could not be read." };
  }
  const value: number = stock.count ?? 0;
  if (!spec.flowColumn) return { ...base, value, changes: null, weekly: null };

  const sinceIso = new Date(nowMs - HISTORY_DAYS * DAY_MS).toISOString();
  let q = db.from(spec.table).select(spec.flowColumn).gte(spec.flowColumn, sinceIso);
  if (spec.flowFilter) q = spec.flowFilter(q);
  const hist = await q.order(spec.flowColumn, { ascending: false }).limit(ROW_LIMIT);
  if (hist.error) {
    return { ...base, value, changes: null, weekly: null, note: "Change is not available: the history could not be read." };
  }
  const rows = (hist.data ?? []) as unknown as Array<Record<string, string | null>>;
  const stamps = rows
    .map((r) => (r[spec.flowColumn as string] ? Date.parse(r[spec.flowColumn as string] as string) : NaN))
    .filter((t) => Number.isFinite(t));
  const changes = {
    week: changeForPeriod(stamps, nowMs, "week"),
    month: changeForPeriod(stamps, nowMs, "month"),
    year: changeForPeriod(stamps, nowMs, "year"),
  };
  return {
    ...base,
    value,
    changes,
    weekly: weeklyBuckets(stamps, nowMs),
    note: rows.length >= ROW_LIMIT ? `Change counts the latest ${ROW_LIMIT} rows only.` : undefined,
  };
}

/** Loads every department metric in parallel. A failing query degrades that one tile, never the page. */
export async function loadDepartmentMetrics(db: Db, now: Date = new Date()): Promise<DepartmentMetric[]> {
  const nowMs = now.getTime();
  const specs = departmentSpecs(now.toISOString());
  return Promise.all(
    specs.map((spec) =>
      loadOne(db, spec, nowMs).catch(
        (): DepartmentMetric => ({
          id: spec.id, department: spec.department, label: spec.label, detail: spec.detail, flowLabel: null,
          value: 0, changes: null, weekly: null, href: spec.href, note: "Not available: the count could not be read.",
        }),
      ),
    ),
  );
}

/** Open items per department: the sum of the metrics marked as work waiting for a person. */
export function openItemsByDepartment(metrics: readonly DepartmentMetric[]) {
  return DEPARTMENT_ORDER.map((department) => {
    const items = metrics.filter((m) => m.department === department && m.openItem && !m.note);
    return {
      department,
      measured: items.length > 0,
      total: items.reduce((sum, m) => sum + m.value, 0),
      parts: items.map((m) => ({ label: m.label, value: m.value })),
    };
  });
}

const ARROW = { up: "▲", down: "▼", flat: "→" } as const;

/** Shares of a total, rounded to whole percent. Empty when the total is zero. */
export function shareOf(parts: readonly { label: string; value: number }[]) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return parts.map((p) => ({ ...p, percent: total > 0 ? Math.round((p.value / total) * 100) : null }));
}

/** The one-line change text for a tile: arrow, percent when it exists, and the counts behind it. */
export function describeChange(metric: DepartmentMetric, period: Period): { text: string; tone?: "good" | "bad" } | null {
  const c = metric.changes?.[period];
  if (!c || !metric.flowLabel) return null;
  if (c.direction === "flat") return null;
  const worse = metric.higherIsWorse === true;
  const tone: "good" | "bad" = (c.direction === "up") !== worse ? "good" : "bad";
  const label = PERIOD_LABEL[period];
  if (c.percent === null) {
    return { text: `${ARROW[c.direction]} ${c.current} ${metric.flowLabel} this ${label}, none in the prior ${label}`, tone };
  }
  return { text: `${ARROW[c.direction]} ${Math.abs(c.percent)}% · ${c.current} ${metric.flowLabel} vs ${c.prior} in the prior ${label}`, tone };
}

/** Rows for the metric drawer: all three periods, whatever period the page is showing. */
export function changeBreakdown(metric: DepartmentMetric): { label: string; value: string; tone?: "good" | "warn" | "bad" }[] {
  if (!metric.changes || !metric.flowLabel) return [];
  return PERIODS.map((period) => {
    const c = metric.changes![period];
    if (!c) return { label: `Last ${PERIOD_DAYS[period]} days vs the ${PERIOD_DAYS[period]} before`, value: "not measurable for this figure" };
    const flag = describeChange(metric, period);
    const pct = c.percent === null ? "no percent, nothing in the prior period" : `${c.percent > 0 ? "+" : ""}${c.percent}%`;
    return {
      label: `Last ${PERIOD_DAYS[period]} days vs the ${PERIOD_DAYS[period]} before`,
      value: `${c.current} vs ${c.prior} · ${c.direction === "flat" ? "unchanged" : pct}`,
      tone: flag?.tone,
    };
  });
}


type Stamped = { t: number; v: number };

/** Sum (or average) of values whose timestamp falls in the current and the prior window. */
export function valueChange(rows: readonly Stamped[], nowMs: number, period: Period, agg: "sum" | "avg"): PeriodChange {
  const w = periodWindow(nowMs, period);
  const cur: number[] = [];
  const pri: number[] = [];
  for (const r of rows) {
    if (r.t > w.currentFrom && r.t <= w.now) cur.push(r.v);
    else if (r.t > w.priorFrom && r.t <= w.currentFrom) pri.push(r.v);
  }
  const fold = (xs: number[]) => {
    if (xs.length === 0) return 0;
    const sum = xs.reduce((a, b) => a + b, 0);
    return Math.round((agg === "avg" ? sum / xs.length : sum) * 10) / 10;
  };
  return computeChange(fold(cur), fold(pri));
}

/** Month and year comparison from a monthly series, oldest to newest. Week is not measurable from months. */
export function monthlyChanges(months: readonly { month: string; v: number }[]): Partial<Record<Period, PeriodChange>> {
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const out: Partial<Record<Period, PeriodChange>> = {};
  const n = sorted.length;
  if (n >= 2) out.month = computeChange(sorted[n - 1]!.v, sorted[n - 2]!.v);
  if (n >= 1) {
    const sum = (xs: typeof sorted) => xs.reduce((a, b) => a + b.v, 0);
    out.year = computeChange(sum(sorted.slice(-12)), sum(sorted.slice(-24, -12)));
  }
  return out;
}

/** The short pill under a ring: arrow and percent, or the plain reason there is none. */
export function pillFor(metric: DepartmentMetric, period: Period): { text: string; tone: "good" | "bad" | "none" } {
  if (metric.note && !metric.changes) return { text: "not available", tone: "none" };
  const c = metric.changes?.[period];
  if (!c || !metric.flowLabel) return { text: metric.changes ? "not measurable" : "no comparison", tone: "none" };
  if (c.current === 0 && c.prior === 0) return { text: "no activity", tone: "none" };
  if (c.direction === "flat") return { text: `${ARROW.flat} unchanged`, tone: "none" };
  const tone: "good" | "bad" = (c.direction === "up") !== (metric.higherIsWorse === true) ? "good" : "bad";
  if (c.percent === null) return { text: `${ARROW[c.direction]} new, none prior`, tone };
  return { text: `${ARROW[c.direction]} ${Math.abs(c.percent)}%`, tone };
}
