// Founder and investor message activity: the loader (service role, staff only).
//
// Reads what iCapOS sent to founders and investors for a date range, plus what it
// sent to investors on each founder's behalf. Sources:
//   email_log                          emails to founders and investors (logged from 28 Sep 2026)
//   notifications                      in-app notifications to founder and investor profiles
//   investor_outreach_recipients       Founder Preview emails to investors, per founder campaign
//   founder_manual_outreach_recipients DIY outreach emails founders sent themselves
//   prospect_intro_requests            founder requests for an introduction to an investor
// and profiles, companies, company_members and subscriptions to label each person.
//
// Every table here is small except notifications, which is read through its
// (recipient_user_id, created_at) index by passing the founder and investor ids.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import {
  type GoalEntry,
  type GoalBasis,
  type MessageActivityData,
  type MessagePerson,
  type MetricKey,
  type ReceivedItem,
  type SentItem,
  METRIC_KEYS,
  localDay,
  dayStartUtc,
  addDays,
  type DayRange,
} from "./message-activity-metrics";

type Db = ReturnType<typeof serviceRoleClientUntyped>;

const EMAIL_LOG_START = "2026-09-28";
const PAGE = 1000;

/** Read every row of a query, a page at a time (PostgREST caps a response at 1,000 rows). */
async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

type ProfileRow = { id: string; full_name: string | null; email: string | null; role: string };
type CompanyRow = { id: string; company_name: string | null; founder_id: string | null; created_at: string };
type MemberRow = { company_id: string; user_id: string };
type SubscriptionRow = { profile_id: string; plan_type: string | null; subscription_status: string | null; grandfathered_free: boolean | null; updated_at: string | null };

function planOf(sub: SubscriptionRow | undefined): Pick<MessagePerson, "plan" | "planGroup"> {
  if (!sub?.plan_type) return { plan: "No plan", planGroup: "none" };
  const base =
    sub.plan_type === "founder_professional" ? { plan: "Professional", planGroup: "professional" as const }
    : sub.plan_type === "founder_basic" ? { plan: "Basic", planGroup: "basic" as const }
    : sub.plan_type === "founder_free" ? { plan: sub.grandfathered_free ? "Free (grandfathered)" : "Free", planGroup: "free" as const }
    : { plan: sub.plan_type.replace(/_/g, " "), planGroup: "none" as const };
  // Signed up and picked a plan but never paid: the platform gives them only the
  // dashboard and settings (access.ts), so they are not counted as on that plan.
  return sub.subscription_status === "pending_payment" ? { plan: `Not paid (chose ${base.plan})`, planGroup: "none" } : base;
}

async function loadPeople(db: Db) {
  const [profiles, companies, members, subs] = await Promise.all([
    readAll<ProfileRow>((a, b) => db.from("profiles").select("id, full_name, email, role").in("role", ["founder", "investor"]).order("id").range(a, b)),
    readAll<CompanyRow>((a, b) => db.from("companies").select("id, company_name, founder_id, created_at").order("created_at").order("id").range(a, b)),
    readAll<MemberRow>((a, b) => db.from("company_members").select("company_id, user_id").order("company_id").order("user_id").range(a, b)),
    readAll<SubscriptionRow>((a, b) => db.from("subscriptions").select("profile_id, plan_type, subscription_status, grandfathered_free, updated_at").order("updated_at", { ascending: false }).order("id").range(a, b)),
  ]);

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const companyOfUser = new Map<string, CompanyRow>();
  for (const c of companies) if (c.founder_id && !companyOfUser.has(c.founder_id)) companyOfUser.set(c.founder_id, c);
  for (const m of members) {
    const c = companyById.get(m.company_id);
    if (c && !companyOfUser.has(m.user_id)) companyOfUser.set(m.user_id, c);
  }
  const subOf = new Map<string, SubscriptionRow>();
  for (const s of subs) if (!subOf.has(s.profile_id)) subOf.set(s.profile_id, s);

  const people = new Map<string, MessagePerson>();
  const byEmail = new Map<string, string>();
  for (const p of profiles) {
    const c = companyOfUser.get(p.id);
    const email = (p.email ?? "").toLowerCase();
    people.set(p.id, {
      key: p.id,
      name: p.full_name?.trim() || email || "Unnamed",
      email,
      role: p.role === "investor" ? "investor" : "founder",
      companyId: c?.id ?? null,
      company: c?.company_name ?? null,
      ...(p.role === "investor" ? { plan: "Investor", planGroup: "none" as const } : planOf(subOf.get(p.id))),
    });
    if (email) byEmail.set(email, p.id);
  }
  const founderOfCompany = new Map<string, string>();
  for (const c of companies) if (c.founder_id) founderOfCompany.set(c.id, c.founder_id);
  for (const m of members) if (!founderOfCompany.has(m.company_id)) founderOfCompany.set(m.company_id, m.user_id);

  return { people, byEmail, founderOfCompany, companyById };
}

type EmailRow = {
  id: number; created_at: string; to_email: string; recipient_user_id: string | null;
  recipient_role: "founder" | "investor"; subject: string | null; source: string | null; job: string | null; status: string;
};
type NotificationRow = {
  id: string; created_at: string; recipient_user_id: string; type: string; title: string | null;
  message: string | null; deep_link: string | null; is_read: boolean;
};
type OutreachRow = {
  id: string; investor_name: string | null; email: string | null; match_score: number | null; status: string;
  sent_at: string | null; created_at: string; campaign_id: string;
};
type CampaignRow = { id: string; company_id: string };
type ManualRow = {
  id: string; company_id: string; name: string | null; email: string | null; status: string;
  last_sent_at: string | null; enrolled_at: string;
};
type ManualCampaignRow = { company_id: string; email_subject: string | null; email_body: string | null };
type IntroRow = {
  id: string; company_id: string; founder_id: string | null; investor_ref: string; status: string;
  note: string | null; handled_at: string | null; created_at: string;
};
type ProspectRow = { id: string; name: string | null; investor_type: string | null };

/** Notifications for these profiles, in id batches so the request URL stays short. */
async function loadNotifications(db: Db, ids: string[], fromIso: string, toIso: string): Promise<NotificationRow[]> {
  const out: NotificationRow[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const batch = ids.slice(i, i + 150);
    out.push(
      ...(await readAll<NotificationRow>((a, b) =>
        db.from("notifications")
          .select("id, created_at, recipient_user_id, type, title, message, deep_link, is_read")
          .in("recipient_user_id", batch)
          .gte("created_at", fromIso).lt("created_at", toIso)
          .order("created_at", { ascending: false }).order("id").range(a, b))),
    );
  }
  return out;
}

/**
 * Everything sent to founders and investors, and on founders' behalf, between two
 * Pacific calendar days (inclusive).
 */
export async function loadMessageActivity(range: DayRange): Promise<MessageActivityData> {
  const db = serviceRoleClientUntyped();
  const fromIso = dayStartUtc(range.start).toISOString();
  const toIso = dayStartUtc(addDays(range.end, 1)).toISOString();
  const inRangeIso = (iso: string | null) => !!iso && iso >= fromIso && iso < toIso;

  const { people, byEmail, founderOfCompany } = await loadPeople(db);
  const ids = [...people.keys()];

  const [emails, notes, outreach, campaigns, manual, manualCampaigns, intros] = await Promise.all([
    readAll<EmailRow>((a, b) =>
      db.from("email_log")
        .select("id, created_at, to_email, recipient_user_id, recipient_role, subject, source, job, status")
        .in("recipient_role", ["founder", "investor"])
        .gte("created_at", fromIso).lt("created_at", toIso)
        .order("created_at", { ascending: false }).order("id").range(a, b)),
    loadNotifications(db, ids, fromIso, toIso),
    readAll<OutreachRow>((a, b) =>
      db.from("investor_outreach_recipients")
        .select("id, investor_name, email, match_score, status, sent_at, created_at, campaign_id")
        .in("status", ["sent", "queued"]).order("id").range(a, b)),
    readAll<CampaignRow>((a, b) => db.from("investor_outreach_campaigns").select("id, company_id").order("id").range(a, b)),
    readAll<ManualRow>((a, b) =>
      db.from("founder_manual_outreach_recipients").select("id, company_id, name, email, status, last_sent_at, enrolled_at").not("last_sent_at", "is", null).order("id").range(a, b)),
    readAll<ManualCampaignRow>((a, b) =>
      db.from("founder_manual_outreach").select("company_id, email_subject, email_body").order("company_id").range(a, b)),
    readAll<IntroRow>((a, b) =>
      db.from("prospect_intro_requests").select("id, company_id, founder_id, investor_ref, status, note, handled_at, created_at").order("id").range(a, b)),
  ]);

  // Someone emailed with no iCapOS profile still gets a row, keyed by address.
  const personKeyForEmail = (row: EmailRow): string => {
    if (row.recipient_user_id && people.has(row.recipient_user_id)) return row.recipient_user_id;
    const email = row.to_email.toLowerCase();
    const known = byEmail.get(email);
    if (known) return known;
    const key = `x:${email}`;
    if (!people.has(key)) {
      people.set(key, {
        key, name: email, email, role: row.recipient_role, companyId: null, company: null,
        plan: "No iCapOS account", planGroup: "none",
      });
    }
    return key;
  };

  const received: ReceivedItem[] = [];
  const investorEmails: EmailRow[] = [];
  for (const e of emails) {
    if (e.recipient_role === "investor" && e.source === "investor-intro") {
      // Founder Preview emails are counted on the Sent side, under the founder they were for.
      investorEmails.push(e);
      continue;
    }
    received.push({
      id: `e${e.id}`, at: e.created_at, personKey: personKeyForEmail(e), channel: "email",
      title: e.subject ?? "(no subject)", message: null, source: e.job ?? e.source ?? "email",
      status: e.status, link: null, emailId: e.id,
    });
  }
  for (const n of notes) {
    received.push({
      id: `n${n.id}`, at: n.created_at, personKey: n.recipient_user_id, channel: "in_app",
      title: n.title ?? n.type, message: n.message, source: n.type,
      status: n.is_read ? "read" : "unread", link: n.deep_link, emailId: null,
    });
  }

  // Founder Preview sends are logged twice: the outreach row (who, for which founder)
  // and the email_log row (the email itself). Pair them by address and time.
  const unmatched = [...investorEmails];
  const emailFor = (address: string | null, at: string | null): EmailRow | null => {
    if (!address || !at) return null;
    const t = Date.parse(at);
    const i = unmatched.findIndex((e) => e.to_email.toLowerCase() === address.toLowerCase() && Math.abs(Date.parse(e.created_at) - t) < 120_000);
    return i === -1 ? null : unmatched.splice(i, 1)[0];
  };

  const founderKey = (companyId: string, founderId?: string | null): string | null => {
    const id = founderId ?? founderOfCompany.get(companyId) ?? null;
    return id && people.has(id) ? id : null;
  };

  const sent: SentItem[] = [];
  const queued: Record<string, number> = {};
  const companyOfCampaign = new Map(campaigns.map((c) => [c.id, c.company_id]));
  for (const o of outreach) {
    const company = companyOfCampaign.get(o.campaign_id);
    const key = company ? founderKey(company) : null;
    if (!key) continue;
    if (o.status === "queued") {
      queued[key] = (queued[key] ?? 0) + 1;
      continue;
    }
    const at = o.sent_at ?? o.created_at;
    if (!inRangeIso(at)) continue;
    const em = o.status === "sent" ? emailFor(o.email, o.sent_at) : null;
    sent.push({
      id: `o${o.id}`, at, personKey: key, kind: "preview", investor: o.investor_name ?? o.email ?? "Investor",
      investorEmail: o.email?.toLowerCase() ?? null, status: o.status,
      title: em?.subject ?? "Founder Preview email",
      emailId: em?.id ?? null,
      detail: [o.match_score !== null ? `Match score ${o.match_score}` : null, em ? null : "No copy stored: email logging started 28 Sep 2026."].filter(Boolean).join(". ") || null,
      handledAt: null,
    });
  }
  const campaignOf = new Map(manualCampaigns.map((c) => [c.company_id, c]));
  for (const m of manual) {
    // Only contacts an email actually went to; enrolled-but-unsent rows have no last_sent_at.
    const at = m.last_sent_at;
    if (!at || !inRangeIso(at)) continue;
    const key = founderKey(m.company_id);
    if (!key) continue;
    const c = campaignOf.get(m.company_id);
    sent.push({
      id: `m${m.id}`, at, personKey: key, kind: "diy", investor: m.name ?? m.email ?? "Investor",
      investorEmail: m.email?.toLowerCase() ?? null, status: m.status,
      title: c?.email_subject ?? "DIY outreach email", emailId: null, detail: c?.email_body ?? null, handledAt: null,
    });
  }

  const introsInRange = intros.filter((i) => inRangeIso(i.created_at));
  const prospectIds = [...new Set(introsInRange.map((i) => i.investor_ref.replace(/^prospect:/, "")).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  const prospects = prospectIds.length
    ? ((await db.from("prospect_investors").select("id, name, investor_type").in("id", prospectIds)).data ?? []) as ProspectRow[]
    : [];
  const prospectById = new Map(prospects.map((p) => [p.id, p]));
  for (const i of introsInRange) {
    const key = founderKey(i.company_id, i.founder_id);
    if (!key) continue;
    const p = prospectById.get(i.investor_ref.replace(/^prospect:/, ""));
    const name = p?.name ?? "Investor";
    sent.push({
      id: `i${i.id}`, at: i.created_at, personKey: key, kind: "intro", investor: name, investorEmail: null,
      status: i.status, title: `Introduction request to ${name}`, emailId: null,
      detail: [p?.investor_type ? `Investor type: ${p.investor_type}.` : null, i.note ? `Founder note: ${i.note}` : null].filter(Boolean).join(" ") || null,
      handledAt: i.handled_at,
    });
  }

  // Investor emails that don't pair with a Founder Preview send are still shown,
  // as received by that investor.
  for (const e of unmatched) {
    received.push({
      id: `e${e.id}`, at: e.created_at, personKey: personKeyForEmail(e), channel: "email",
      title: e.subject ?? "(no subject)", message: null, source: e.job ?? e.source ?? "email",
      status: e.status, link: null, emailId: e.id,
    });
  }

  received.sort((a, b) => (a.at < b.at ? 1 : -1));
  sent.sort((a, b) => (a.at < b.at ? 1 : -1));

  return {
    people: [...people.values()],
    received,
    sent,
    queued,
    emailLogStart: EMAIL_LOG_START,
    generatedAt: new Date().toISOString(),
  };
}

// ── Goals ───────────────────────────────────────────────────────────────────

type GoalRow = {
  id: string; metric_key: string; effective_month: string; per_month: number | string | null;
  amount: number | string | null; basis: string | null; direction: "up" | "down"; note: string | null;
  created_by: string | null; created_at: string;
};

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

/** Every goal entry, oldest month first. Empty (not an error) until the migration is applied. */
export async function loadGoals(): Promise<{ entries: GoalEntry[]; tableMissing: boolean }> {
  const db = serviceRoleClientUntyped();
  const { data, error } = await db
    .from("message_activity_goals")
    .select("id, metric_key, effective_month, per_month, amount, basis, direction, note, created_by, created_at")
    .order("effective_month");
  if (error) {
    const missing = /does not exist|schema cache|PGRST205/i.test(error.message);
    if (missing) return { entries: [], tableMissing: true };
    throw new Error(error.message);
  }
  const rows = (data ?? []) as GoalRow[];
  const authorIds = [...new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (authorIds.length) {
    const { data: ps } = await db.from("profiles").select("id, full_name, email").in("id", authorIds);
    for (const p of (ps ?? []) as ProfileRow[]) names.set(p.id, p.full_name?.trim() || p.email || "Staff");
  }
  return {
    tableMissing: false,
    entries: rows
      .filter((r) => (METRIC_KEYS as string[]).includes(r.metric_key))
      .map((r) => ({
        id: r.id,
        metricKey: r.metric_key as MetricKey,
        month: r.effective_month.slice(0, 7),
        perMonth: num(r.per_month),
        amount: num(r.amount),
        basis: (r.basis as GoalBasis | null) ?? null,
        direction: r.direction,
        note: r.note,
        createdBy: r.created_by,
        createdByName: r.created_by ? names.get(r.created_by) ?? "Staff" : null,
        createdAt: r.created_at,
      })),
  };
}

export type GoalInput = {
  metricKey: MetricKey;
  month: string;
  perMonth: number | null;
  amount: number | null;
  basis: GoalBasis | null;
  direction: "up" | "down";
  note: string | null;
};

/** Set (or stop) the goal for a metric from a month. Replaces an entry for the same month. */
export async function saveGoal(input: GoalInput, userId: string): Promise<void> {
  const db = serviceRoleClientUntyped();
  const { error } = await db.from("message_activity_goals").upsert(
    {
      metric_key: input.metricKey,
      effective_month: `${input.month}-01`,
      per_month: input.perMonth,
      amount: input.amount,
      basis: input.basis,
      direction: input.direction,
      note: input.note,
      created_by: userId,
      created_at: new Date().toISOString(),
    },
    { onConflict: "metric_key,effective_month" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteGoal(id: string): Promise<void> {
  const db = serviceRoleClientUntyped();
  const { error } = await db.from("message_activity_goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Today's Pacific calendar day. */
export function todayLocal(): string {
  return localDay(new Date());
}
