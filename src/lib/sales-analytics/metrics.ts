// Sales Hub Analytics — read-only metric cards over the sales CRM. One batched load
// of opportunities + stages + activity + settings, then everything computed in JS.
// Wrapped so a missing/empty source degrades to a "—" card instead of throwing.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { monthlyRecurringCents } from "@/lib/sales/opportunities";
import { formatCurrency } from "@/lib/ui/format-display";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export type MetricGroup = "pipeline" | "performance";
export interface SalesMetric {
  key: string; group: MetricGroup; label: string; value: string; delta: string;
  series: number[]; drivers: Array<{ label: string; value: string }>; note?: string;
}

const money = (cents: number) => formatCurrency(Math.round(cents), { cents: true });
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

function last8Keys(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) { const m = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`); }
  return out;
}
function bucket(rows: Array<{ date: string | null | undefined; amt: number }>): number[] {
  const keys = last8Keys();
  const map = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) { if (!r.date) continue; const k = String(r.date).slice(0, 7); if (map.has(k)) map.set(k, (map.get(k) ?? 0) + r.amt); }
  return keys.map((k) => map.get(k) ?? 0);
}

interface Opp {
  status: string | null; value_cents: number | null; billing: string | null; probability: number | null;
  stage_id: string | null; created_at: string | null; updated_at: string | null; last_activity_at: string | null;
}

async function loadRaw(ownerId?: string | null) {
  let oppQ = db().from("sales_opportunities").select("status, value_cents, billing, probability, stage_id, created_at, updated_at, last_activity_at");
  let actQ = db().from("sales_activity_log").select("created_at");
  if (ownerId) { oppQ = oppQ.eq("owner_id", ownerId); actQ = actQ.eq("actor_id", ownerId); }
  const [{ data: opps }, { data: stages }, { data: acts }, { data: settings }] = await Promise.all([
    oppQ,
    db().from("sales_stages").select("id, is_won"),
    actQ,
    db().from("sales_settings").select("stalled_days").eq("id", "default").maybeSingle(),
  ]);
  return {
    opps: (opps ?? []) as Opp[],
    wonStageIds: new Set(((stages ?? []) as Array<{ id: string; is_won: boolean }>).filter((s) => s.is_won).map((s) => s.id)),
    activities: (acts ?? []) as Array<{ created_at: string | null }>,
    stalledDays: (settings?.stalled_days as number | undefined) ?? 14,
  };
}
type Raw = Awaited<ReturnType<typeof loadRaw>>;

const mrrOf = (o: Opp) => monthlyRecurringCents({ value_cents: o.value_cents, billing: (o.billing as "yearly" | "monthly") ?? "yearly" }) ?? 0;
const drivers = (pairs: Array<[string, string]>) => pairs.map(([label, value]) => ({ label, value }));

function build(raw: Raw): SalesMetric[] {
  const open = raw.opps.filter((o) => o.status === "open");
  const won = raw.opps.filter((o) => o.status === "won");
  const lost = raw.opps.filter((o) => o.status === "lost");
  const openValues = open.map((o) => o.value_cents ?? 0);
  const openValue = openValues.reduce((a, b) => a + b, 0);
  const weighted = open.reduce((a, o) => a + (o.value_cents ?? 0) * ((o.probability ?? 0) / 100), 0);
  const expectedMrr = open.reduce((a, o) => a + mrrOf(o), 0);
  const mean = openValues.length ? openValue / openValues.length : 0;
  const sorted = [...openValues].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const decided = won.length + lost.length;
  const winRate = pct(won.length, decided);

  // Avg sales cycle (won): updated_at − created_at in days (no explicit closed_at column).
  const cycleDays = won.map((o) => (o.created_at && o.updated_at ? (Date.parse(o.updated_at) - Date.parse(o.created_at)) / 86400000 : NaN)).filter((n) => Number.isFinite(n) && n >= 0);
  const avgCycle = cycleDays.length ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : null;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const newMtd = raw.opps.filter((o) => o.created_at && Date.parse(o.created_at) >= monthStart).length;

  const stalledCut = Date.now() - raw.stalledDays * 86400000;
  const stalled = open.filter((o) => { const t = o.last_activity_at ?? o.updated_at; return t && Date.parse(t) < stalledCut; });
  const stalledValue = stalled.reduce((a, o) => a + (o.value_cents ?? 0), 0);

  const act7 = raw.activities.filter((a) => a.created_at && Date.parse(a.created_at) >= Date.now() - 7 * 86400000).length;

  const createdSeriesVal = bucket(raw.opps.map((o) => ({ date: o.created_at, amt: o.value_cents ?? 0 })));
  const createdSeriesCount = bucket(raw.opps.map((o) => ({ date: o.created_at, amt: 1 })));
  const wonSeries = bucket(won.map((o) => ({ date: o.updated_at, amt: 1 })));
  const actSeries = bucket(raw.activities.map((a) => ({ date: a.created_at, amt: 1 })));

  return [
    { key: "open", group: "pipeline", label: "Open pipeline", value: money(openValue), delta: `${open.length} open deals`, series: createdSeriesVal, drivers: drivers([["Open deals", String(open.length)], ["Total value", money(openValue)]]) },
    { key: "weighted", group: "pipeline", label: "Weighted pipeline", value: money(weighted), delta: "by win probability", series: bucket(open.map((o) => ({ date: o.created_at, amt: (o.value_cents ?? 0) * ((o.probability ?? 0) / 100) }))), drivers: drivers([["Weighted", money(weighted)], ["Unweighted", money(openValue)]]) },
    { key: "mrr", group: "pipeline", label: "Expected MRR", value: money(expectedMrr), delta: "from open deals", series: bucket(open.map((o) => ({ date: o.created_at, amt: mrrOf(o) }))), drivers: drivers([["Expected MRR", money(expectedMrr)], [`At ${winRate}% win`, money(expectedMrr * (winRate / 100))]]) },
    { key: "deal", group: "pipeline", label: "Avg deal size", value: money(mean), delta: `median ${money(median)}`, series: createdSeriesVal, drivers: drivers([["Mean", money(mean)], ["Median", money(median)], ["Largest open", money(Math.max(0, ...openValues))]]) },
    { key: "win", group: "performance", label: "Win rate", value: `${winRate}%`, delta: `${won.length} of ${decided} decided`, series: wonSeries, drivers: drivers([["Won", String(won.length)], ["Lost", String(lost.length)], ["Win rate", `${winRate}%`]]) },
    { key: "cycle", group: "performance", label: "Avg sales cycle", value: avgCycle != null ? `${avgCycle} days` : "—", delta: `${won.length} won deals`, series: wonSeries, drivers: drivers([["Avg cycle", avgCycle != null ? `${avgCycle}d` : "—"], ["Won sample", String(cycleDays.length)]]), note: "Cycle approximated from created→last-updated on won deals." },
    { key: "new", group: "performance", label: "New opportunities", value: String(newMtd), delta: "this month", series: createdSeriesCount, drivers: drivers([["New (MTD)", String(newMtd)], ["All-time", String(raw.opps.length)]]) },
    { key: "stalled", group: "performance", label: "Stalled deals", value: String(stalled.length), delta: `>${raw.stalledDays}d no activity`, series: createdSeriesCount, drivers: drivers([["Stalled", String(stalled.length)], ["At risk", money(stalledValue)]]) },
    { key: "activity", group: "performance", label: "Activities logged", value: String(act7), delta: "last 7 days", series: actSeries, drivers: drivers([["Activities (7d)", String(act7)], ["All-time", String(raw.activities.length)]]) },
  ];
}

export async function loadSalesAnalytics(ownerId?: string | null): Promise<SalesMetric[]> {
  try { return build(await loadRaw(ownerId)); } catch { return []; }
}

export async function loadSalesMetric(key: string, ownerId?: string | null): Promise<SalesMetric | null> {
  try { return build(await loadRaw(ownerId)).find((m) => m.key === key) ?? null; } catch { return null; }
}
