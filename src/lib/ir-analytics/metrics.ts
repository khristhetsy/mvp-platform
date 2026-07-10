// Investor Relations Analytics — read-only metric cards. Every metric reads real
// tables via the service-role client and is wrapped so a missing/empty source
// degrades to a "—" card instead of throwing. No writes anywhere.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/ui/format-display";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export type MetricGroup = "funnel" | "ir";
export interface IrMetric {
  key: string;
  group: MetricGroup;
  label: string;
  value: string;          // formatted for display
  delta: string;          // short caption
  series: number[];       // last 8 periods (may be empty)
  drivers: Array<{ label: string; value: string }>;
  note?: string;          // caveat, e.g. approximation
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
const money = (cents: number) => formatCurrency(Math.round(cents), { cents: true });

function last8Keys(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
function bucketCounts(dates: Array<string | null | undefined>): number[] {
  const keys = last8Keys();
  const map = new Map(keys.map((k) => [k, 0]));
  for (const d of dates) {
    if (!d) continue;
    const k = String(d).slice(0, 7);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return keys.map((k) => map.get(k) ?? 0);
}
function bucketSum(rows: Array<{ date: string | null | undefined; amt: number }>): number[] {
  const keys = last8Keys();
  const map = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) {
    if (!r.date) continue;
    const k = String(r.date).slice(0, 7);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + r.amt);
  }
  return keys.map((k) => map.get(k) ?? 0);
}
const EMPTY = (key: string, group: MetricGroup, label: string): IrMetric =>
  ({ key, group, label, value: "—", delta: "no data", series: [], drivers: [] });

async function safe(fn: () => Promise<IrMetric>, fallback: IrMetric): Promise<IrMetric> {
  try { return await fn(); } catch { return fallback; }
}

// 1. Trial → paid conversion. Only rows with a real trial_started_at count as trials,
//    so the legacy backfill (founders seeded straight to paid) can't inflate the rate.
async function trialConversion(): Promise<IrMetric> {
  const { data } = await db().from("subscriptions").select("plan_type, subscription_status, trial_started_at, current_period_start");
  const rows = (data ?? []) as Array<{ plan_type: string | null; subscription_status: string | null; trial_started_at: string | null; current_period_start: string | null }>;
  const trials = rows.filter((r) => r.trial_started_at);
  const paidPlans = new Set(["founder_basic", "founder_professional"]);
  const converted = trials.filter((r) => r.plan_type && paidPlans.has(r.plan_type));
  const rate = pct(converted.length, trials.length);
  const days = converted.map((r) => (r.current_period_start && r.trial_started_at ? (Date.parse(r.current_period_start) - Date.parse(r.trial_started_at)) / 86400000 : NaN)).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  const median = days.length ? Math.round(days[Math.floor(days.length / 2)]) : null;
  return {
    key: "trial", group: "funnel", label: "Trial → paid conversion",
    value: `${rate}%`, delta: `${converted.length} of ${trials.length} trials`,
    series: bucketCounts(trials.map((r) => r.trial_started_at)),
    drivers: [["Trials started", String(trials.length)], ["Converted", String(converted.length)], ["Median days to pay", median != null ? `${median}d` : "—"]].map(([label, value]) => ({ label, value })),
  };
}

// 2. Onboarding completion — companies.onboarding_completed_at (the signal Ops Hub trusts).
async function onboardingCompletion(): Promise<IrMetric> {
  const { data } = await db().from("companies").select("id, onboarding_completed_at");
  const rows = (data ?? []) as Array<{ onboarding_completed_at: string | null }>;
  const total = rows.length;
  const done = rows.filter((r) => r.onboarding_completed_at);
  return {
    key: "onboarding", group: "funnel", label: "Onboarding completion",
    value: `${pct(done.length, total)}%`, delta: `${done.length} of ${total} companies`,
    series: bucketCounts(done.map((r) => r.onboarding_completed_at)),
    drivers: [["Completed", String(done.length)], ["Total companies", String(total)]].map(([label, value]) => ({ label, value })),
  };
}

// 3. AI due-diligence completion — a diligence_reports row existing = complete.
async function ddCompletion(): Promise<IrMetric> {
  const [{ data: comps }, { data: dd }] = await Promise.all([
    db().from("companies").select("id"),
    db().from("diligence_reports").select("company_id, created_at, readiness_score"),
  ]);
  const total = ((comps ?? []) as Array<{ id: string }>).length;
  const rows = (dd ?? []) as Array<{ company_id: string; created_at: string | null; readiness_score: number | null }>;
  const distinct = new Set(rows.map((r) => r.company_id));
  const scores = rows.map((r) => r.readiness_score).filter((s): s is number => typeof s === "number");
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  return {
    key: "dd", group: "funnel", label: "AI due diligence completion",
    value: `${pct(distinct.size, total)}%`, delta: `${distinct.size} of ${total} companies`,
    series: bucketCounts(rows.map((r) => r.created_at)),
    drivers: [["Companies with DD", String(distinct.size)], ["Avg readiness score", avg != null ? String(avg) : "—"]].map(([label, value]) => ({ label, value })),
  };
}

// 4. Active investors — approved investor_profiles; "active" = investor_activity in 30d.
async function activeInvestors(): Promise<IrMetric> {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: profiles }, { data: activity }] = await Promise.all([
    db().from("investor_profiles").select("profile_id, approval_status, approved_at"),
    db().from("investor_activity").select("investor_id, created_at").gte("created_at", cutoff),
  ]);
  const approved = ((profiles ?? []) as Array<{ approval_status: string | null; approved_at: string | null }>).filter((p) => p.approval_status === "approved");
  const activeIds = new Set(((activity ?? []) as Array<{ investor_id: string }>).map((a) => a.investor_id));
  return {
    key: "investors", group: "ir", label: "Active investors",
    value: String(approved.length), delta: `${activeIds.size} active in 30d`,
    series: bucketCounts(approved.map((p) => p.approved_at)),
    drivers: [["Approved", String(approved.length)], ["Active (30d)", String(activeIds.size)], ["Dormant", String(Math.max(0, approved.length - activeIds.size))]].map(([label, value]) => ({ label, value })),
  };
}

// 5. Intro requests — open vs facilitated, with a 7-day response SLA age.
async function introRequests(): Promise<IrMetric> {
  const { data } = await db().from("intro_requests").select("status, created_at, facilitated_at");
  const rows = (data ?? []) as Array<{ status: string | null; created_at: string | null; facilitated_at: string | null }>;
  const open = rows.filter((r) => r.status === "requested" || r.status === "reviewing");
  const facilitated = rows.filter((r) => r.status === "facilitated");
  const slaCut = Date.now() - 7 * 86400000;
  const pastSla = open.filter((r) => r.created_at && Date.parse(r.created_at) < slaCut).length;
  return {
    key: "intros", group: "ir", label: "Intro requests",
    value: String(open.length), delta: `${facilitated.length} facilitated`,
    series: bucketCounts(rows.map((r) => r.created_at)),
    drivers: [["Open", String(open.length)], ["Facilitated", String(facilitated.length)], ["Past 7-day SLA", String(pastSla)]].map(([label, value]) => ({ label, value })),
  };
}

// 6. Active deal rooms.
async function dealRooms(): Promise<IrMetric> {
  const { data } = await db().from("deal_rooms").select("status, created_at");
  const rows = (data ?? []) as Array<{ status: string | null; created_at: string | null }>;
  const active = rows.filter((r) => r.status === "active");
  return {
    key: "dealrooms", group: "ir", label: "Active deal rooms",
    value: String(active.length), delta: `${rows.length} total`,
    series: bucketCounts(rows.map((r) => r.created_at)),
    drivers: [["Active", String(active.length)], ["All-time", String(rows.length)]].map(([label, value]) => ({ label, value })),
  };
}

// 7. SPV commitments — committed capital + follow-through.
async function spvCommitments(): Promise<IrMetric> {
  const { data } = await db().from("spv_participations").select("indicative_amount, status, created_at");
  const rows = (data ?? []) as Array<{ indicative_amount: number | null; status: string | null; created_at: string | null }>;
  const committedStatuses = new Set(["soft_committed", "documents_pending", "completed"]);
  const committed = rows.filter((r) => r.status && committedStatuses.has(r.status));
  const amount = committed.reduce((a, r) => a + (Number(r.indicative_amount) || 0), 0);
  const completed = rows.filter((r) => r.status === "completed").length;
  const followThrough = pct(completed, committed.length);
  return {
    key: "spv", group: "ir", label: "SPV commitments",
    value: money(amount * 100), delta: `${followThrough}% follow-through`,
    series: bucketSum(committed.map((r) => ({ date: r.created_at, amt: (Number(r.indicative_amount) || 0) }))),
    drivers: [["Committed", money(amount * 100)], ["Completed", String(completed)], ["Follow-through", `${followThrough}%`]].map(([label, value]) => ({ label, value })),
    note: "Amounts are indicative commitments, not settled funds.",
  };
}

// 8. Match interest — no stored match-acceptance exists, so we surface real investor
//    interest signals (expressed interest) rather than a fabricated acceptance rate.
async function matchInterest(): Promise<IrMetric> {
  const { data } = await db().from("investor_interests").select("status, created_at");
  const rows = (data ?? []) as Array<{ status: string | null; created_at: string | null }>;
  return {
    key: "matching", group: "ir", label: "Investor match interest",
    value: String(rows.length), delta: "expressed interest",
    series: bucketCounts(rows.map((r) => r.created_at)),
    drivers: [["Total interest", String(rows.length)]].map(([label, value]) => ({ label, value })),
    note: "Match acceptance isn't separately tracked — this is expressed-interest volume.",
  };
}

// 9. Compliance flags — open, high/critical.
async function complianceFlags(): Promise<IrMetric> {
  const { data } = await db().from("compliance_events").select("status, severity, created_at");
  const rows = (data ?? []) as Array<{ status: string | null; severity: string | null; created_at: string | null }>;
  const openRows = rows.filter((r) => r.status === "open" || r.status === "under_review");
  const critical = openRows.filter((r) => r.severity === "high" || r.severity === "critical");
  return {
    key: "compliance", group: "ir", label: "Compliance flags",
    value: String(critical.length), delta: `${openRows.length} open total`,
    series: bucketCounts(rows.map((r) => r.created_at)),
    drivers: [["Critical open", String(critical.length)], ["Open total", String(openRows.length)]].map(([label, value]) => ({ label, value })),
  };
}

const BUILDERS: Array<[() => Promise<IrMetric>, IrMetric]> = [
  [trialConversion, EMPTY("trial", "funnel", "Trial → paid conversion")],
  [onboardingCompletion, EMPTY("onboarding", "funnel", "Onboarding completion")],
  [ddCompletion, EMPTY("dd", "funnel", "AI due diligence completion")],
  [activeInvestors, EMPTY("investors", "ir", "Active investors")],
  [introRequests, EMPTY("intros", "ir", "Intro requests")],
  [dealRooms, EMPTY("dealrooms", "ir", "Active deal rooms")],
  [spvCommitments, EMPTY("spv", "ir", "SPV commitments")],
  [matchInterest, EMPTY("matching", "ir", "Investor match interest")],
  [complianceFlags, EMPTY("compliance", "ir", "Compliance flags")],
];

export async function loadIrAnalytics(): Promise<IrMetric[]> {
  return Promise.all(BUILDERS.map(([fn, fb]) => safe(fn, fb)));
}

export async function loadIrMetric(key: string): Promise<IrMetric | null> {
  const entry = BUILDERS.find(([, fb]) => fb.key === key);
  if (!entry) return null;
  return safe(entry[0], entry[1]);
}
