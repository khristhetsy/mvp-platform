// Investor reach: every introduction and outreach email that went (or is
// queued to go) to an investor, for one founder company or for one investor.
//
// Three sources, one row shape:
//   Introductions      prospect_intro_requests (brokered, the live flow) and
//                      intro_requests (platform investors)
//   Automated outreach investor_outreach_recipients (+ campaigns for the company)
//   Manual outreach    founder_manual_outreach_recipients (+ the sequence)
//
// Every investor here is an Investor Contact record (crm_contacts): outreach
// investor_ref is the contact id, a prospect's source_ref is the contact id, and
// manual recipients carry contact_id. Delivery and opens come from email_log,
// matched on recipient address, source and send time, so past sends are covered
// without any schema change. Read only; service role with explicit filters, the
// caller authorizes first.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type ReachCard = "intro" | "auto" | "manual";
export type ReachTone = "good" | "warn" | "info" | "bad" | "muted";

export type ReachRow = {
  key: string;
  card: ReachCard;
  /** Investor Contact record (crm_contacts.id), when known. */
  contactId: string | null;
  name: string;
  firm: string | null;
  email: string | null;
  companyId: string;
  companyName: string | null;
  /** Introductions: when the founder asked. */
  requestedAt: string | null;
  status: string;
  statusTone: ReachTone;
  /** When the email went out (null: not sent). */
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  repliedAt: string | null;
  /** Automated: match score. */
  matchScore: number | null;
  /** Manual: "2 of 3". */
  step: string | null;
  /** email_log ids of the emails behind this row, oldest first (the View window). */
  mailIds: number[];
  /** Replies are looked up from this instant on. */
  since: string | null;
  /** One line of context, e.g. "Marked contacted Oct 7, not emailed from iCapOS". */
  note: string | null;
};

export type InvestorReach = { intros: ReachRow[]; auto: ReachRow[]; manual: ReachRow[] };

type Db = SupabaseClient;
function db(): Db {
  return createServiceRoleClient() as unknown as Db;
}

type Contact = { id: string; name: string | null; email: string | null; company: string | null; supabase_profile_id: string | null };
type LogRow = {
  id: number;
  to_email: string;
  source: string | null;
  created_at: string;
  status: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
};

/** Sources that are bulk or automated sends, never an introduction email. */
export const NON_INTRO_SOURCES = new Set(["investor-intro", "manual-outreach", "marketing-campaign", "match-campaign", "mass-email"]);

const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** The email_log row for an automated send: same address and source, closest to sent_at (within 30 minutes). */
export function pickNearest(logs: LogRow[], email: string | null, source: string, at: string | null): LogRow | null {
  if (!email || !at) return null;
  const t = Date.parse(at);
  let best: LogRow | null = null;
  let gap = 30 * 60 * 1000;
  for (const l of logs) {
    if (l.source !== source || lc(l.to_email) !== lc(email)) continue;
    const d = Math.abs(Date.parse(l.created_at) - t);
    if (d <= gap) {
      gap = d;
      best = l;
    }
  }
  return best;
}

/** Emails to this address from `since`, matching `keep`, oldest first. */
export function logsFor(logs: LogRow[], email: string | null, since: string | null, keep: (l: LogRow) => boolean): LogRow[] {
  if (!email) return [];
  const from = since ? Date.parse(since) : 0;
  return logs
    .filter((l) => lc(l.to_email) === lc(email) && Date.parse(l.created_at) >= from && keep(l))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

const latest = (vals: Array<string | null | undefined>) => vals.filter((v): v is string => Boolean(v)).sort().pop() ?? null;
const earliest = (vals: Array<string | null | undefined>) => vals.filter((v): v is string => Boolean(v)).sort()[0] ?? null;

async function loadContacts(client: Db, ids: string[]): Promise<Map<string, Contact>> {
  const out = new Map<string, Contact>();
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await client.from("crm_contacts").select("id, name, email, company, supabase_profile_id").in("id", uniq.slice(i, i + 200));
    for (const c of (data ?? []) as Contact[]) out.set(c.id, c);
  }
  return out;
}

async function loadLogs(client: Db, emails: string[], since: string | null): Promise<LogRow[]> {
  const addrs = [...new Set(emails.filter(Boolean).flatMap((e) => [e.trim(), lc(e)]))];
  if (!addrs.length) return [];
  const rows: LogRow[] = [];
  for (let i = 0; i < addrs.length; i += 150) {
    let q = client
      .from("email_log")
      .select("id, to_email, source, created_at, status, delivered_at, opened_at, clicked_at, bounced_at")
      .in("to_email", addrs.slice(i, i + 150))
      .order("created_at", { ascending: true })
      .limit(2000);
    if (since) q = q.gte("created_at", since);
    const { data } = await q;
    rows.push(...((data ?? []) as LogRow[]));
  }
  return rows.filter((r) => r.status !== "skipped");
}

async function companyNames(client: Db, ids: string[]): Promise<Map<string, string | null>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const { data } = await client.from("companies").select("id, company_name").in("id", uniq);
  return new Map(((data ?? []) as Array<{ id: string; company_name: string | null }>).map((c) => [c.id, c.company_name]));
}

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });

/**
 * Reach for one founder company (`companyId`) or one investor contact (`contactId`).
 * Rows newest first within each card.
 */
export async function loadInvestorReach(scope: { companyId: string } | { contactId: string }): Promise<InvestorReach> {
  const client = db();
  const byCompany = "companyId" in scope;

  // ── Investor scope: who is this contact everywhere? ───────────────────────
  let me: Contact | null = null;
  let prospectRefs: string[] = [];
  if (!byCompany) {
    me = (await loadContacts(client, [scope.contactId])).get(scope.contactId) ?? null;
    if (!me) return { intros: [], auto: [], manual: [] };
    const { data: pros } = await client.from("prospect_investors").select("id").eq("source_ref", me.id);
    prospectRefs = ((pros ?? []) as Array<{ id: string }>).map((p) => `prospect:${p.id}`);
  }

  // ── Raw rows ──────────────────────────────────────────────────────────────
  type Pir = { id: string; company_id: string; investor_ref: string; status: string; note: string | null; handled_at: string | null; created_at: string };
  let pirQ = client.from("prospect_intro_requests").select("id, company_id, investor_ref, status, note, handled_at, created_at").order("created_at", { ascending: false });
  pirQ = byCompany ? pirQ.eq("company_id", scope.companyId) : prospectRefs.length ? pirQ.in("investor_ref", prospectRefs) : pirQ.eq("investor_ref", "__none__");

  type Ir = { id: string; company_id: string; investor_id: string | null; pipeline_investor_id: string | null; status: string; created_at: string; facilitated_at: string | null; direction: string | null };
  let irQ = client.from("intro_requests").select("id, company_id, investor_id, pipeline_investor_id, status, created_at, facilitated_at, direction").order("created_at", { ascending: false });
  irQ = byCompany ? irQ.eq("company_id", scope.companyId) : me?.supabase_profile_id ? irQ.eq("investor_id", me.supabase_profile_id) : irQ.eq("id", "00000000-0000-0000-0000-000000000000");

  type Ior = { id: string; campaign_id: string; investor_ref: string; investor_name: string | null; match_score: number | null; status: string; sent_at: string | null; created_at: string; opened_at: string | null; clicked_at: string | null; email: string | null };
  let campaignIds: string[] = [];
  const campaignCompany = new Map<string, string>();
  if (byCompany) {
    const { data: camps } = await client.from("investor_outreach_campaigns").select("id, company_id").eq("company_id", scope.companyId);
    for (const c of (camps ?? []) as Array<{ id: string; company_id: string }>) campaignCompany.set(c.id, c.company_id);
    campaignIds = [...campaignCompany.keys()];
  }
  let iorQ = client.from("investor_outreach_recipients").select("id, campaign_id, investor_ref, investor_name, match_score, status, sent_at, created_at, opened_at, clicked_at, email").neq("status", "canceled").order("created_at", { ascending: false }).limit(1000);
  iorQ = byCompany ? (campaignIds.length ? iorQ.in("campaign_id", campaignIds) : iorQ.eq("id", "00000000-0000-0000-0000-000000000000")) : iorQ.eq("investor_ref", me!.id);

  type Fm = { id: string; company_id: string; contact_id: string | null; email: string; name: string | null; next_step_index: number; status: string; last_sent_at: string | null; enrolled_at: string | null; replied_at: string | null; opened_at: string | null; clicked_at: string | null };
  let fmQ = client.from("founder_manual_outreach_recipients").select("id, company_id, contact_id, email, name, next_step_index, status, last_sent_at, enrolled_at, replied_at, opened_at, clicked_at").order("enrolled_at", { ascending: false });
  fmQ = byCompany ? fmQ.eq("company_id", scope.companyId) : me!.email ? fmQ.or(`contact_id.eq.${me!.id},email.ilike.${me!.email.replace(/[,()]/g, "")}`) : fmQ.eq("contact_id", me!.id);

  const [pirRes, irRes, iorRes, fmRes] = await Promise.all([pirQ, irQ, iorQ, fmQ]);
  const pirs = (pirRes.data ?? []) as Pir[];
  const irs = (irRes.data ?? []) as Ir[];
  const iors = (iorRes.data ?? []) as Ior[];
  const fms = (fmRes.data ?? []) as Fm[];

  // Investor scope: campaigns → company ids.
  if (!byCompany && iors.length) {
    const { data: camps } = await client.from("investor_outreach_campaigns").select("id, company_id").in("id", [...new Set(iors.map((r) => r.campaign_id))]);
    for (const c of (camps ?? []) as Array<{ id: string; company_id: string }>) campaignCompany.set(c.id, c.company_id);
  }

  // Manual sequences (step count) per company.
  const fmCompanies = [...new Set(fms.map((r) => r.company_id))];
  const stepsByCompany = new Map<string, number>();
  if (fmCompanies.length) {
    const { data: seqs } = await client.from("founder_manual_outreach").select("company_id, sequence").in("company_id", fmCompanies);
    for (const s of (seqs ?? []) as Array<{ company_id: string; sequence: unknown }>) stepsByCompany.set(s.company_id, Array.isArray(s.sequence) ? s.sequence.length : 0);
  }

  // ── People ────────────────────────────────────────────────────────────────
  const prospectIds = [...new Set(pirs.map((p) => p.investor_ref).filter((r) => r.startsWith("prospect:")).map((r) => r.slice(9)))];
  const prospectContact = new Map<string, string>();
  const prospectName = new Map<string, string>();
  if (prospectIds.length) {
    const { data } = await client.from("prospect_investors").select("id, name, source_ref").in("id", prospectIds);
    for (const p of (data ?? []) as Array<{ id: string; name: string; source_ref: string | null }>) {
      prospectName.set(p.id, p.name);
      if (p.source_ref) prospectContact.set(p.id, p.source_ref);
    }
  }
  const contacts = me
    ? new Map([[me.id, me]])
    : await loadContacts(client, [...prospectContact.values(), ...iors.map((r) => r.investor_ref), ...fms.map((r) => r.contact_id ?? "")]);

  // Platform investors (intro_requests) and pipeline investors.
  const profIds = [...new Set(irs.map((r) => r.investor_id).filter((v): v is string => Boolean(v)))];
  const pipeIds = [...new Set(irs.map((r) => r.pipeline_investor_id).filter((v): v is string => Boolean(v)))];
  const [profRes, pipeRes, ipRes] = await Promise.all([
    profIds.length ? client.from("profiles").select("id, full_name, email").in("id", profIds) : Promise.resolve({ data: [] }),
    pipeIds.length ? client.from("pipeline_investors").select("id, name, contact_email").in("id", pipeIds) : Promise.resolve({ data: [] }),
    profIds.length ? client.from("investor_profiles").select("profile_id, firm_name").in("profile_id", profIds) : Promise.resolve({ data: [] }),
  ]);
  const prof = new Map(((profRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p]));
  const pipe = new Map(((pipeRes.data ?? []) as Array<{ id: string; name: string; contact_email: string | null }>).map((p) => [p.id, p]));
  const firmOf = new Map(((ipRes.data ?? []) as Array<{ profile_id: string; firm_name: string | null }>).map((p) => [p.profile_id, p.firm_name]));

  // ── Email log ─────────────────────────────────────────────────────────────
  const allEmails = [
    ...[...prospectContact.values()].map((id) => contacts.get(id)?.email ?? ""),
    ...[...prof.values()].map((p) => p.email ?? ""),
    ...[...pipe.values()].map((p) => p.contact_email ?? ""),
    ...iors.map((r) => r.email ?? contacts.get(r.investor_ref)?.email ?? ""),
    ...fms.map((r) => r.email),
  ];
  const sinceAll = earliest([...pirs.map((p) => p.created_at), ...irs.map((p) => p.created_at), ...iors.map((r) => r.created_at), ...fms.map((r) => r.enrolled_at)]);
  const logs = await loadLogs(client, allEmails, sinceAll);

  const names = await companyNames(client, [
    ...pirs.map((p) => p.company_id),
    ...irs.map((p) => p.company_id),
    ...[...campaignCompany.values()],
    ...fms.map((r) => r.company_id),
  ]);

  const mailFields = (ls: LogRow[]) => ({
    sentAt: ls[0]?.created_at ?? null,
    deliveredAt: latest(ls.map((l) => l.delivered_at)),
    openedAt: earliest(ls.map((l) => l.opened_at)),
    clickedAt: earliest(ls.map((l) => l.clicked_at)),
    bouncedAt: latest(ls.map((l) => l.bounced_at)),
    mailIds: ls.map((l) => l.id),
  });

  // ── Introductions ─────────────────────────────────────────────────────────
  const intros: ReachRow[] = [];
  const introMail = (l: LogRow) => !NON_INTRO_SOURCES.has(l.source ?? "");
  for (const p of pirs) {
    const pid = p.investor_ref.startsWith("prospect:") ? p.investor_ref.slice(9) : null;
    const cid = pid ? prospectContact.get(pid) ?? null : null;
    const c = cid ? contacts.get(cid) ?? null : null;
    const ls = p.status === "dismissed" ? [] : logsFor(logs, c?.email ?? null, p.created_at, introMail);
    const status = p.status === "contacted" ? "Contacted" : p.status === "dismissed" ? "Declined" : "Requested";
    intros.push({
      key: `pir:${p.id}`,
      card: "intro",
      contactId: cid,
      name: c?.name || (pid ? prospectName.get(pid) : null) || "Investor",
      firm: c?.company ?? null,
      email: c?.email ?? null,
      companyId: p.company_id,
      companyName: names.get(p.company_id) ?? null,
      requestedAt: p.created_at,
      status,
      statusTone: status === "Contacted" ? "good" : status === "Declined" ? "bad" : "warn",
      ...mailFields(ls),
      repliedAt: null,
      matchScore: null,
      step: null,
      since: p.created_at,
      note: p.status === "contacted" && ls.length === 0 ? `Marked contacted${p.handled_at ? ` ${DAY.format(new Date(p.handled_at))}` : ""}. No email to this investor was sent from iCapOS.` : null,
    });
  }
  for (const r of irs) {
    const pr = r.investor_id ? prof.get(r.investor_id) : null;
    const pi = r.pipeline_investor_id ? pipe.get(r.pipeline_investor_id) : null;
    const email = pr?.email ?? pi?.contact_email ?? null;
    const ls = r.status === "declined" ? [] : logsFor(logs, email, r.created_at, introMail);
    const status = r.status === "facilitated" ? "Facilitated" : r.status === "declined" ? "Declined" : r.status === "reviewing" ? "Reviewing" : "Requested";
    intros.push({
      key: `ir:${r.id}`,
      card: "intro",
      contactId: me?.id ?? null,
      name: pr?.full_name || pi?.name || email || "Investor",
      firm: r.investor_id ? firmOf.get(r.investor_id) ?? null : null,
      email,
      companyId: r.company_id,
      companyName: names.get(r.company_id) ?? null,
      requestedAt: r.created_at,
      status,
      statusTone: status === "Facilitated" ? "good" : status === "Declined" ? "bad" : status === "Reviewing" ? "info" : "warn",
      ...mailFields(ls),
      repliedAt: null,
      matchScore: null,
      step: null,
      since: r.created_at,
      note: null,
    });
  }
  intros.sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));

  // ── Automated outreach ────────────────────────────────────────────────────
  const auto: ReachRow[] = iors.map((r) => {
    const c = contacts.get(r.investor_ref) ?? null;
    const email = r.email ?? c?.email ?? null;
    const l = r.status === "sent" ? pickNearest(logs, email, "investor-intro", r.sent_at) : null;
    const opened = l?.opened_at ?? r.opened_at;
    const clicked = l?.clicked_at ?? r.clicked_at;
    const companyId = campaignCompany.get(r.campaign_id) ?? "";
    const status =
      r.status === "queued" ? "Queued" : r.status === "skipped" ? "Skipped" : l?.bounced_at ? "Bounced" : clicked ? "Clicked" : opened ? "Opened" : r.status === "sent" ? "Sent" : r.status;
    return {
      key: `ior:${r.id}`,
      card: "auto",
      contactId: c?.id ?? null,
      name: c?.name || r.investor_name || email || "Investor",
      firm: c?.company ?? null,
      email,
      companyId,
      companyName: names.get(companyId) ?? null,
      requestedAt: null,
      status,
      statusTone: status === "Queued" ? "info" : status === "Skipped" || status === "Bounced" ? "bad" : status === "Clicked" || status === "Opened" ? "good" : "muted",
      sentAt: r.status === "sent" ? r.sent_at : null,
      deliveredAt: l?.delivered_at ?? null,
      openedAt: opened,
      clickedAt: clicked,
      bouncedAt: l?.bounced_at ?? null,
      repliedAt: null,
      matchScore: typeof r.match_score === "number" ? Math.round(r.match_score) : null,
      step: null,
      mailIds: l ? [l.id] : [],
      since: r.sent_at,
      note: r.status === "sent" && !l ? "Logged as sent in test mode. No email reached this investor." : r.status === "skipped" ? "Skipped: no email, unsubscribed or on the do-not-contact list." : null,
    };
  });

  // ── Manual outreach ───────────────────────────────────────────────────────
  const manual: ReachRow[] = fms.map((r) => {
    const c = r.contact_id ? contacts.get(r.contact_id) ?? null : null;
    const total = stepsByCompany.get(r.company_id) ?? 0;
    const ls = logsFor(logs, r.email, r.enrolled_at, (l) => l.source === "manual-outreach");
    const sentSteps = Math.min(r.next_step_index, total || r.next_step_index);
    const status = r.replied_at ? "Replied" : r.status === "stopped" ? "Stopped" : r.status === "completed" ? "Done" : r.next_step_index === 0 ? "Waiting" : "Sent";
    const m = mailFields(ls);
    return {
      key: `fm:${r.id}`,
      card: "manual",
      contactId: c?.id ?? r.contact_id,
      name: r.name || c?.name || r.email,
      firm: c?.company ?? null,
      email: r.email,
      companyId: r.company_id,
      companyName: names.get(r.company_id) ?? null,
      requestedAt: null,
      status,
      statusTone: status === "Replied" ? "good" : status === "Stopped" ? "bad" : status === "Waiting" ? "info" : "muted",
      sentAt: r.last_sent_at ?? (ls.length ? ls[ls.length - 1].created_at : null),
      deliveredAt: m.deliveredAt,
      openedAt: m.openedAt ?? r.opened_at,
      clickedAt: m.clickedAt ?? r.clicked_at,
      bouncedAt: m.bouncedAt,
      repliedAt: r.replied_at,
      matchScore: null,
      step: total ? `${sentSteps} of ${total}` : null,
      mailIds: m.mailIds,
      since: r.enrolled_at,
      note: r.last_sent_at && ls.length === 0 ? "Logged as sent in test mode. No email reached this investor." : null,
    };
  });

  return { intros, auto, manual };
}

/** Resolve the investor page id: a contact id, or a registered investor's profile id. */
export async function resolveInvestorContact(id: string): Promise<{ id: string; name: string | null; email: string | null; company: string | null } | null> {
  const client = db();
  const { data: byId } = await client.from("crm_contacts").select("id, name, email, company").eq("id", id).maybeSingle();
  if (byId) return byId as { id: string; name: string | null; email: string | null; company: string | null };
  const { data: byProfile } = await client.from("crm_contacts").select("id, name, email, company").eq("supabase_profile_id", id).limit(1).maybeSingle();
  if (byProfile) return byProfile as { id: string; name: string | null; email: string | null; company: string | null };
  const { data: p } = await client.from("profiles").select("email").eq("id", id).maybeSingle();
  const email = (p as { email: string | null } | null)?.email;
  if (!email) return null;
  const { data: byEmail } = await client.from("crm_contacts").select("id, name, email, company").ilike("email", email).limit(1).maybeSingle();
  return (byEmail as { id: string; name: string | null; email: string | null; company: string | null } | null) ?? null;
}

// ── The View window ──────────────────────────────────────────────────────────

export type ReceivedMail = { at: string; from: string; subject: string | null; html: string | null; text: string | null; via: "inbox" | "forwarded" };

/**
 * Replies from this address since `since`: messages in the iCapOS inbox, and
 * manual-outreach replies that were forwarded to the founder (the forward keeps
 * the investor's reply text).
 */
export async function loadReceived(email: string, since: string | null): Promise<ReceivedMail[]> {
  const client = db();
  const addr = email.trim();
  if (!addr.includes("@")) return [];
  const safe = addr.replace(/[%_,()]/g, "");
  let inQ = client
    .from("email_messages")
    .select("created_at, from_email, from_name, subject, body_html, body_text")
    .eq("direction", "inbound")
    .ilike("from_email", safe)
    .order("created_at", { ascending: true })
    .limit(20);
  if (since) inQ = inQ.gte("created_at", since);
  let fwQ = client
    .from("email_log")
    .select("created_at, subject, body_html, body_text")
    .ilike("subject", "Reply from %")
    .ilike("body_text", `%${safe}%`)
    .order("created_at", { ascending: true })
    .limit(20);
  if (since) fwQ = fwQ.gte("created_at", since);
  const [inbox, fwd] = await Promise.all([inQ, fwQ]);
  const out: ReceivedMail[] = [];
  for (const m of (inbox.data ?? []) as Array<{ created_at: string; from_email: string; from_name: string | null; subject: string | null; body_html: string | null; body_text: string | null }>) {
    out.push({ at: m.created_at, from: m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email, subject: m.subject, html: m.body_html, text: m.body_text, via: "inbox" });
  }
  for (const m of (fwd.data ?? []) as Array<{ created_at: string; subject: string | null; body_html: string | null; body_text: string | null }>) {
    out.push({ at: m.created_at, from: addr, subject: (m.subject ?? "").replace(/^Reply from [^:]*:\s*/, "") || null, html: m.body_html, text: m.body_text, via: "forwarded" });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
