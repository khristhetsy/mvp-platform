/**
 * Follow-up results for Sales Analytics: what came of the emails we sent through
 * sequences (and campaigns), per period, with a comparison period.
 *
 * Sources (all already recorded — nothing new is tracked):
 *   sent / opened / clicked / replied / bounced  → marketing_events (per sequence + step)
 *   enrolled                                     → marketing_sequence_enrollments
 *   meetings                                     → scheduling_bookings (booker_email matches a
 *                                                  contact we emailed in the period)
 *   won                                          → sales_opportunities status = won whose
 *                                                  contact_email we emailed before the win
 *   one-off emails                               → sales_activity_log kind = 'email' (Inbox compose)
 *
 * Conversion rate = won ÷ enrolled. The pure functions (period math, bucketing, rollup)
 * are unit-tested; the loaders at the bottom are the only IO.
 */
import { marketingDb } from "@/lib/marketing/db";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type Grain = "week" | "30d" | "quarter" | "year";
export type Compare = "prev" | "yoy";
export const GRAINS: Grain[] = ["week", "30d", "quarter", "year"];
export const GRAIN_LABELS: Record<Grain, string> = { week: "Week", "30d": "30d", quarter: "Quarter", year: "Year" };

const DAY = 86_400_000;

export type Range = { start: Date; end: Date };

/** Current window for a grain (end = now), and its comparison window. */
export function periodRange(grain: Grain, now: Date, compare: Compare): { cur: Range; cmp: Range } {
  const end = new Date(now.getTime());
  const days = grain === "week" ? 7 : grain === "30d" ? 30 : grain === "quarter" ? 91 : 365;
  const start = new Date(end.getTime() - days * DAY);
  if (compare === "yoy") {
    const s = new Date(start); s.setFullYear(s.getFullYear() - 1);
    const e = new Date(end); e.setFullYear(e.getFullYear() - 1);
    return { cur: { start, end }, cmp: { start: s, end: e } };
  }
  return { cur: { start, end }, cmp: { start: new Date(start.getTime() - days * DAY), end: start } };
}

/** Daily buckets for week / 30d, weekly buckets for quarter / year. */
export function bucketStarts(grain: Grain, range: Range): Date[] {
  const step = grain === "week" || grain === "30d" ? DAY : 7 * DAY;
  const out: Date[] = [];
  for (let t = range.start.getTime(); t < range.end.getTime(); t += step) out.push(new Date(t));
  return out;
}
export function bucketIndex(grain: Grain, range: Range, at: Date): number {
  const step = grain === "week" || grain === "30d" ? DAY : 7 * DAY;
  const i = Math.floor((at.getTime() - range.start.getTime()) / step);
  const n = Math.ceil((range.end.getTime() - range.start.getTime()) / step);
  return i < 0 || i >= n ? -1 : i;
}
export const bucketLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ── Pure rollup ─────────────────────────────────────────────────────────────
export type EventRow = { sequence_id: string | null; step_id: string | null; campaign_id: string | null; contact_id: string; email: string; event_type: string; occurred_at: string };
export type EnrollRow = { sequence_id: string; contact_id: string; status: string; enrolled_at: string };
export type BookingRow = { booker_email: string | null; created_at: string; status: string };
export type WonRow = { contact_email: string | null; value_cents: number | null; updated_at: string };

export type Totals = {
  enrolled: number; sent: number; opened: number; replied: number; meetings: number; won: number; wonCents: number;
  openPct: number | null; replyPct: number | null; conversionPct: number | null;
};
export type Series = { labels: string[]; sent: number[]; opened: number[]; replied: number[]; meetings: number[]; won: number[]; wonCents: number[] };
export type SequenceRow = Totals & { id: string; name: string };

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function emptyTotals(): Totals {
  return { enrolled: 0, sent: 0, opened: 0, replied: 0, meetings: 0, won: 0, wonCents: 0, openPct: null, replyPct: null, conversionPct: null };
}
function finish(t: Totals): Totals {
  return { ...t, openPct: pct(t.opened, t.sent), replyPct: pct(t.replied, t.sent), conversionPct: pct(t.won, t.enrolled) };
}

/**
 * Roll events / enrollments / bookings / wins inside `range` into totals, a per-bucket
 * series and per-sequence rows. Opened and replied count unique (sequence, contact, step)
 * so a contact opening one email five times is one open. Meetings and wins are attributed
 * to the sequence that emailed that address most recently before the booking / win.
 */
export function rollup(grain: Grain, range: Range, input: {
  events: EventRow[]; enrollments: EnrollRow[]; bookings: BookingRow[]; won: WonRow[];
  sequences: Array<{ id: string; name: string }>;
}): { totals: Totals; series: Series; sequences: SequenceRow[]; oneOff: { sent: number } } {
  const inRange = (iso: string) => { const t = new Date(iso).getTime(); return t >= range.start.getTime() && t < range.end.getTime(); };
  const starts = bucketStarts(grain, range);
  const zeros = () => starts.map(() => 0);
  const series: Series = { labels: starts.map(bucketLabel), sent: zeros(), opened: zeros(), replied: zeros(), meetings: zeros(), won: zeros(), wonCents: zeros() };
  const bySeq = new Map<string, Totals>();
  const seqName = new Map(input.sequences.map((s) => [s.id, s.name]));
  const seqTotals = (id: string) => { let t = bySeq.get(id); if (!t) { t = emptyTotals(); bySeq.set(id, t); } return t; };
  const total = emptyTotals();

  // Which sequence last emailed each address (and when) — for attributing meetings / wins.
  const lastSentByEmail = new Map<string, { sequence_id: string | null; at: number }>();
  const seenOpen = new Set<string>(), seenReply = new Set<string>();
  for (const e of input.events) {
    const t = new Date(e.occurred_at).getTime();
    if (e.event_type === "sent" && e.email) {
      const prev = lastSentByEmail.get(lower(e.email));
      if (!prev || prev.at < t) lastSentByEmail.set(lower(e.email), { sequence_id: e.sequence_id, at: t });
    }
    if (!inRange(e.occurred_at)) continue;
    const bi = bucketIndex(grain, range, new Date(e.occurred_at));
    const key = `${e.sequence_id ?? e.campaign_id ?? "-"}|${e.contact_id}|${e.step_id ?? "-"}`;
    if (e.event_type === "sent") {
      total.sent++; if (bi >= 0) series.sent[bi]++;
      if (e.sequence_id) seqTotals(e.sequence_id).sent++;
    } else if (e.event_type === "opened") {
      if (seenOpen.has(key)) continue; seenOpen.add(key);
      total.opened++; if (bi >= 0) series.opened[bi]++;
      if (e.sequence_id) seqTotals(e.sequence_id).opened++;
    } else if (e.event_type === "replied") {
      if (seenReply.has(key)) continue; seenReply.add(key);
      total.replied++; if (bi >= 0) series.replied[bi]++;
      if (e.sequence_id) seqTotals(e.sequence_id).replied++;
    }
  }
  for (const en of input.enrollments) {
    if (!inRange(en.enrolled_at)) continue;
    total.enrolled++; seqTotals(en.sequence_id).enrolled++;
  }
  for (const b of input.bookings) {
    if (b.status === "cancelled" || !inRange(b.created_at)) continue;
    const hit = lastSentByEmail.get(lower(b.booker_email));
    if (!hit || hit.at > new Date(b.created_at).getTime()) continue;   // only meetings that followed an email
    total.meetings++; const bi = bucketIndex(grain, range, new Date(b.created_at)); if (bi >= 0) series.meetings[bi]++;
    if (hit.sequence_id) seqTotals(hit.sequence_id).meetings++;
  }
  for (const w of input.won) {
    if (!inRange(w.updated_at)) continue;
    const hit = lastSentByEmail.get(lower(w.contact_email));
    if (!hit || hit.at > new Date(w.updated_at).getTime()) continue;
    const cents = w.value_cents ?? 0;
    total.won++; total.wonCents += cents;
    const bi = bucketIndex(grain, range, new Date(w.updated_at)); if (bi >= 0) { series.won[bi]++; series.wonCents[bi] += cents; }
    if (hit.sequence_id) { const t = seqTotals(hit.sequence_id); t.won++; t.wonCents += cents; }
  }
  const sequences: SequenceRow[] = [...bySeq.entries()]
    .map(([id, t]) => ({ id, name: seqName.get(id) ?? "Deleted sequence", ...finish(t) }))
    .sort((a, b) => b.sent - a.sent || b.enrolled - a.enrolled);
  return { totals: finish(total), series, sequences, oneOff: { sent: 0 } };
}

// ── IO ──────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sales(): any { return createServiceRoleClient(); }

async function loadInputs(from: Date, to: Date) {
  const db = marketingDb();
  const [ev, en, bk, wn, sq] = await Promise.all([
    db.from("marketing_events").select("sequence_id, step_id, campaign_id, contact_id, email, event_type, occurred_at")
      .gte("occurred_at", new Date(from.getTime() - 60 * DAY).toISOString())   // include earlier sends so attribution can look back
      .lt("occurred_at", to.toISOString()).in("event_type", ["sent", "opened", "replied"]).limit(100000),
    db.from("marketing_sequence_enrollments").select("sequence_id, contact_id, status, enrolled_at").gte("enrolled_at", from.toISOString()).lt("enrolled_at", to.toISOString()).limit(50000),
    sales().from("scheduling_bookings").select("booker_email, created_at, status").gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).limit(20000),
    sales().from("sales_opportunities").select("contact_email, value_cents, updated_at").eq("status", "won").gte("updated_at", from.toISOString()).lt("updated_at", to.toISOString()).limit(20000),
    db.from("marketing_sequences").select("id, name"),
  ]);
  for (const r of [ev, en, bk, wn, sq]) if (r.error) throw new Error(`Follow-up results: ${r.error.message}`);
  return {
    events: (ev.data ?? []) as EventRow[], enrollments: (en.data ?? []) as EnrollRow[],
    bookings: (bk.data ?? []) as BookingRow[], won: (wn.data ?? []) as WonRow[],
    sequences: (sq.data ?? []) as Array<{ id: string; name: string }>,
  };
}

async function countOneOff(range: Range): Promise<number> {
  const { count, error } = await sales().from("sales_activity_log").select("id", { count: "exact", head: true })
    .eq("kind", "email").gte("created_at", range.start.toISOString()).lt("created_at", range.end.toISOString());
  if (error) throw new Error(`Follow-up results: ${error.message}`);
  return count ?? 0;
}

export type FollowupResults = {
  grain: Grain; compare: Compare;
  period: { start: string; end: string }; comparison: { start: string; end: string };
  totals: Totals; prevTotals: Totals;
  series: Series; prevSeries: Series;
  sequences: SequenceRow[]; oneOff: { sent: number };
};

export async function loadFollowupResults(grain: Grain, compare: Compare, now = new Date()): Promise<FollowupResults> {
  const { cur, cmp } = periodRange(grain, now, compare);
  const from = new Date(Math.min(cur.start.getTime(), cmp.start.getTime()));
  const to = new Date(Math.max(cur.end.getTime(), cmp.end.getTime()));
  const [inputs, oneOff] = await Promise.all([loadInputs(from, to), countOneOff(cur)]);
  const a = rollup(grain, cur, inputs);
  const b = rollup(grain, cmp, inputs);
  return {
    grain, compare,
    period: { start: cur.start.toISOString(), end: cur.end.toISOString() }, comparison: { start: cmp.start.toISOString(), end: cmp.end.toISOString() },
    totals: a.totals, prevTotals: b.totals, series: a.series, prevSeries: b.series, sequences: a.sequences, oneOff: { sent: oneOff },
  };
}

// ── Per-sequence detail (on expand) ─────────────────────────────────────────
export type SequenceDetail = {
  chain: { enrolled: number; opened: number; replied: number; meetings: number; won: number; wonCents: number };
  steps: Array<{ id: string; order: number; name: string; delayDays: number; sent: number; opened: number; replied: number; bounced: number }>;
  trend: Array<{ weekStart: string; sent: number; replied: number }>;
  states: { active: number; completed: number; unsubscribed: number; bounced: number };
  people: Array<{ crmId: string | null; name: string; company: string | null; email: string; outcome: "won" | "meeting" | "replied"; at: string }>;
};

export async function loadSequenceDetail(sequenceId: string, grain: Grain, now = new Date()): Promise<SequenceDetail> {
  const { cur } = periodRange(grain, now, "prev");
  const db = marketingDb();
  const sixWeeksAgo = new Date(now.getTime() - 42 * DAY);
  const [st, ev, en, sq] = await Promise.all([
    db.from("marketing_sequence_steps").select("id, step_order, delay_days, template:marketing_templates(name, subject)").eq("sequence_id", sequenceId).order("step_order"),
    db.from("marketing_events").select("step_id, contact_id, email, event_type, occurred_at").eq("sequence_id", sequenceId)
      .gte("occurred_at", new Date(Math.min(cur.start.getTime(), sixWeeksAgo.getTime())).toISOString()).limit(50000),
    db.from("marketing_sequence_enrollments").select("contact_id, status, enrolled_at, contact:marketing_contacts(email, first_name, last_name, company)").eq("sequence_id", sequenceId).limit(20000),
    db.from("marketing_sequences").select("id").eq("id", sequenceId).maybeSingle(),
  ]);
  for (const r of [st, ev, en, sq]) if (r.error) throw new Error(`Sequence detail: ${r.error.message}`);
  if (!sq.data) throw new Error("Sequence not found.");
  const inCur = (iso: string) => { const t = new Date(iso).getTime(); return t >= cur.start.getTime() && t < cur.end.getTime(); };

  type Ev = { step_id: string | null; contact_id: string; email: string; event_type: string; occurred_at: string };
  const events = (ev.data ?? []) as Ev[];
  type StepRow = { id: string; step_order: number; delay_days: number; template: { name?: string; subject?: string } | { name?: string; subject?: string }[] | null };
  const steps = ((st.data ?? []) as StepRow[]).map((s) => {
    const tpl = Array.isArray(s.template) ? s.template[0] : s.template;
    return { id: s.id, order: s.step_order, name: tpl?.subject || tpl?.name || `Step ${s.step_order}`, delayDays: s.delay_days, sent: 0, opened: 0, replied: 0, bounced: 0 };
  });
  const stepById = new Map(steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const openedContacts = new Set<string>(), repliedContacts = new Map<string, string>();
  const lastSentAt = new Map<string, number>();
  for (const e of events) {
    if (e.event_type === "sent") { const t = new Date(e.occurred_at).getTime(); if ((lastSentAt.get(lower(e.email)) ?? 0) < t) lastSentAt.set(lower(e.email), t); }
    if (!inCur(e.occurred_at)) continue;
    const s = e.step_id ? stepById.get(e.step_id) : undefined;
    const key = `${e.event_type}|${e.contact_id}|${e.step_id ?? "-"}`;
    if (e.event_type !== "sent" && e.event_type !== "bounced") { if (seen.has(key)) continue; seen.add(key); }
    if (e.event_type === "sent" && s) s.sent++;
    else if (e.event_type === "opened") { if (s) s.opened++; openedContacts.add(e.contact_id); }
    else if (e.event_type === "replied") { if (s) s.replied++; if (!repliedContacts.has(e.contact_id)) repliedContacts.set(e.contact_id, e.occurred_at); }
    else if (e.event_type === "bounced" && s) s.bounced++;
  }

  // Six-week trend (sent vs replied), Monday-aligned weeks.
  const weekStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const trendMap = new Map<string, { sent: number; replied: number }>();
  for (let w = weekStart(sixWeeksAgo); w <= now; w = new Date(w.getTime() + 7 * DAY)) trendMap.set(w.toISOString().slice(0, 10), { sent: 0, replied: 0 });
  const seenTrend = new Set<string>();
  for (const e of events) {
    if (new Date(e.occurred_at) < sixWeeksAgo) continue;
    const k = weekStart(new Date(e.occurred_at)).toISOString().slice(0, 10);
    const cell = trendMap.get(k); if (!cell) continue;
    if (e.event_type === "sent") cell.sent++;
    else if (e.event_type === "replied") { const rk = `${e.contact_id}|${e.step_id ?? "-"}`; if (!seenTrend.has(rk)) { seenTrend.add(rk); cell.replied++; } }
  }

  type EnRow = { contact_id: string; status: string; enrolled_at: string; contact: { email: string; first_name: string | null; last_name: string | null; company: string | null } | { email: string; first_name: string | null; last_name: string | null; company: string | null }[] | null };
  const enrollments = (en.data ?? []) as EnRow[];
  const states = { active: 0, completed: 0, unsubscribed: 0, bounced: 0 };
  const enrolledCur = enrollments.filter((e) => inCur(e.enrolled_at));
  for (const e of enrollments) if (e.status in states) states[e.status as keyof typeof states]++;
  const contactOf = (e: EnRow) => (Array.isArray(e.contact) ? e.contact[0] : e.contact);
  const emailByContact = new Map(enrollments.map((e) => [e.contact_id, contactOf(e)]));

  // Meetings + wins for these contacts (period), attributed if they followed a send.
  const emails = [...new Set([...emailByContact.values()].map((c) => lower(c?.email)).filter(Boolean))];
  const people: SequenceDetail["people"] = [];
  let meetings = 0, won = 0, wonCents = 0;
  if (emails.length) {
    const chunks: string[][] = []; for (let i = 0; i < emails.length; i += 200) chunks.push(emails.slice(i, i + 200));
    const [bks, wns, crm] = await Promise.all([
      Promise.all(chunks.map((c) => sales().from("scheduling_bookings").select("booker_email, created_at, status").in("booker_email", c).gte("created_at", cur.start.toISOString()).lt("created_at", cur.end.toISOString()))),
      Promise.all(chunks.map((c) => sales().from("sales_opportunities").select("contact_email, value_cents, updated_at").eq("status", "won").in("contact_email", c).gte("updated_at", cur.start.toISOString()).lt("updated_at", cur.end.toISOString()))),
      Promise.all(chunks.map((c) => sales().from("crm_contacts").select("id, email, name, company").in("email", c))),
    ]);
    const crmByEmail = new Map<string, { id: string; name: string; company: string | null }>();
    for (const r of crm) for (const c of (r.data ?? []) as Array<{ id: string; email: string; name: string; company: string | null }>) crmByEmail.set(lower(c.email), c);
    const outcome = new Map<string, { outcome: "won" | "meeting" | "replied"; at: string; cents?: number }>();
    for (const r of wns) for (const w of (r.data ?? []) as WonRow[]) {
      const em = lower(w.contact_email); if ((lastSentAt.get(em) ?? Infinity) > new Date(w.updated_at).getTime()) continue;
      won++; wonCents += w.value_cents ?? 0; outcome.set(em, { outcome: "won", at: w.updated_at, cents: w.value_cents ?? 0 });
    }
    for (const r of bks) for (const b of (r.data ?? []) as BookingRow[]) {
      const em = lower(b.booker_email); if (b.status === "cancelled" || (lastSentAt.get(em) ?? Infinity) > new Date(b.created_at).getTime()) continue;
      meetings++; if (!outcome.has(em)) outcome.set(em, { outcome: "meeting", at: b.created_at });
    }
    for (const [cid, at] of repliedContacts) { const em = lower(emailByContact.get(cid)?.email); if (em && !outcome.has(em)) outcome.set(em, { outcome: "replied", at }); }
    for (const [em, o] of outcome) {
      const mc = [...emailByContact.values()].find((c) => lower(c?.email) === em);
      const crmRow = crmByEmail.get(em);
      const name = crmRow?.name || [mc?.first_name, mc?.last_name].filter(Boolean).join(" ") || em;
      people.push({ crmId: crmRow?.id ?? null, name, company: crmRow?.company ?? mc?.company ?? null, email: em, outcome: o.outcome, at: o.at });
    }
    const rank = { won: 0, meeting: 1, replied: 2 };
    people.sort((a, b) => rank[a.outcome] - rank[b.outcome] || b.at.localeCompare(a.at));
  }
  return {
    chain: { enrolled: enrolledCur.length, opened: openedContacts.size, replied: repliedContacts.size, meetings, won, wonCents },
    steps, trend: [...trendMap.entries()].map(([weekStart, v]) => ({ weekStart, ...v })), states, people,
  };
}
