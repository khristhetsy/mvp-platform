/**
 * Results for a Match campaign: measured counts only, never projections. Every
 * figure is read from a table at request time; a stage with nothing yet shows
 * as blank (null), not zero-filled estimates. Server only.
 */
import { marketingDb } from "@/lib/marketing/db";
import { getMatchCampaign, listCampaignFounders, type CampaignFounderRow } from "./store";
import type { FounderType } from "./types";

const PAID_PLANS = ["founder_basic", "founder_professional", "founder_managed_ir"];
const DAY = 24 * 60 * 60 * 1000;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type IntroToApprove = {
  kind: "prospect" | "member";
  id: string;
  company: string | null;
  investor: string | null;
  plan: string | null;
  status: string;
  created_at: string;
};

export type BreakdownRow = { key: string; emailed: number; converted: number };

export type MatchResults = {
  emailed: number;
  dryRun: number;
  opened: number | null;
  pageOpened: number | null;
  callClicks: number | null;
  booked: number | null;
  introClicks: number | null;
  plans: number | null;
  introsRequested: number | null;
  introduced: number | null;
  revenueCents: number | null;
  costUsd: number | null;
  roi: number | null;
  byFounderType: BreakdownRow[];
  byIndustry: BreakdownRow[];
  byStage: BreakdownRow[];
  introsToApprove: IntroToApprove[];
};

const orNull = (n: number) => (n > 0 ? n : null);

/**
 * Links founders to accounts by email, then reads plans, bookings and intro
 * requests created after each founder was emailed. Writes back
 * founder_profile_id and plan_started_at so the link is kept.
 */
export async function loadMatchResults(campaignId: string): Promise<MatchResults> {
  const db = marketingDb();
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  const founders = (await listCampaignFounders(campaignId)).filter((f) => f.send_status === "sent" || f.send_status === "dry_run");
  const emailed = founders.filter((f) => f.send_status === "sent");
  const dryRun = founders.length - emailed.length;

  // Accounts by email.
  const byEmail = new Map<string, CampaignFounderRow>();
  for (const f of founders) if (f.email) byEmail.set(f.email.trim().toLowerCase(), f);
  const profileOf = new Map<string, string>(); // campaign founder id -> profile id
  for (const part of chunk([...byEmail.keys()], 200)) {
    const { data } = await db.from("profiles").select("id, email").in("email", part);
    for (const p of (data ?? []) as Array<{ id: string; email: string | null }>) {
      const f = p.email ? byEmail.get(p.email.trim().toLowerCase()) : undefined;
      if (f) profileOf.set(f.id, p.id);
    }
  }
  const profileIds = [...new Set(profileOf.values())];

  // Plans started after the email.
  const subs = new Map<string, { plan_type: string; created_at: string; monthly_price_cents: number | null }>();
  for (const part of chunk(profileIds, 200)) {
    const { data } = await db.from("subscriptions").select("profile_id, plan_type, created_at, monthly_price_cents").in("profile_id", part).in("plan_type", PAID_PLANS);
    for (const s of (data ?? []) as Array<{ profile_id: string; plan_type: string; created_at: string; monthly_price_cents: number | null }>) subs.set(s.profile_id, s);
  }
  let plans = 0;
  let revenueCents = 0;
  const converted = new Set<string>();
  for (const f of founders) {
    const pid = profileOf.get(f.id);
    const sub = pid ? subs.get(pid) : undefined;
    const started = sub && f.sent_at && new Date(sub.created_at) >= new Date(f.sent_at) ? sub.created_at : null;
    if (started) {
      plans++;
      converted.add(f.id);
      // Billing periods begun inside the first 90 days, up to today.
      const days = Math.min(90, Math.max(0, (Date.now() - new Date(started).getTime()) / DAY));
      const periods = Math.floor(days / 30) + 1;
      revenueCents += periods * (sub?.monthly_price_cents ?? 0);
    }
    if ((pid && pid !== f.founder_profile_id) || (started && started !== f.plan_started_at)) {
      await db.from("match_campaign_founders").update({ founder_profile_id: pid ?? null, plan_started_at: started }).eq("id", f.id);
    }
  }

  // Calls booked after a Schedule a call click.
  let booked = 0;
  const callers = founders.filter((f) => f.clicked_call_at);
  for (const part of chunk(callers, 100)) {
    const emails = part.map((f) => f.email).filter((e): e is string => Boolean(e));
    const [byContact, byMail] = await Promise.all([
      db.from("scheduling_bookings").select("contact_crm_id, booker_email, created_at").in("contact_crm_id", part.map((f) => f.founder_contact_id)),
      emails.length ? db.from("scheduling_bookings").select("contact_crm_id, booker_email, created_at").in("booker_email", emails) : Promise.resolve({ data: [] }),
    ]);
    const data = [...((byContact.data ?? []) as unknown[]), ...((byMail.data ?? []) as unknown[])];
    const rows = (data ?? []) as Array<{ contact_crm_id: string | null; booker_email: string | null; created_at: string }>;
    for (const f of part) {
      const hit = rows.some(
        (b) =>
          (b.contact_crm_id === f.founder_contact_id || (b.booker_email && f.email && b.booker_email.toLowerCase() === f.email.toLowerCase())) &&
          new Date(b.created_at) >= new Date(f.clicked_call_at as string),
      );
      if (hit) booked++;
    }
  }

  // Opens from the email provider (same events the campaign stats read).
  const { data: opens } = await db.from("marketing_events").select("email").eq("campaign_id", campaignId).eq("event_type", "opened");
  const opened = new Set(((opens ?? []) as Array<{ email: string }>).map((o) => o.email.toLowerCase())).size;

  // Introduction requests by these founders after the email: brokered (CRM investors) and member.
  const since = founders.reduce<string | null>((min, f) => (!min || (f.sent_at && f.sent_at < min) ? f.sent_at : min), null);
  const introsToApprove: IntroToApprove[] = [];
  let requested = 0;
  let introduced = 0;
  if (profileIds.length && since) {
    for (const part of chunk(profileIds, 200)) {
      const [{ data: prospect }, { data: member }] = await Promise.all([
        db.from("prospect_intro_requests").select("id, founder_id, company_id, investor_ref, status, created_at").in("founder_id", part).gte("created_at", since),
        db.from("intro_requests").select("id, requested_by, company_id, investor_id, status, created_at").in("requested_by", part).gte("created_at", since),
      ]);
      const planOf = (pid: string) => subs.get(pid)?.plan_type?.replace("founder_", "") ?? null;
      const companyIds = [
        ...new Set([...((prospect ?? []) as Array<{ company_id: string }>), ...((member ?? []) as Array<{ company_id: string }>)].map((r) => r.company_id)),
      ];
      const companyName = new Map<string, string | null>();
      if (companyIds.length) {
        const { data: cos } = await db.from("companies").select("id, company_name").in("id", companyIds);
        for (const c of (cos ?? []) as Array<{ id: string; company_name: string | null }>) companyName.set(c.id, c.company_name);
      }
      const name = (id: string) => companyName.get(id) ?? null;
      for (const r of (prospect ?? []) as Array<{ id: string; founder_id: string; company_id: string; investor_ref: string; status: string; created_at: string }>) {
        requested++;
        if (r.status === "contacted") introduced++;
        if (r.status === "new") introsToApprove.push({ kind: "prospect", id: r.id, company: name(r.company_id), investor: r.investor_ref, plan: planOf(r.founder_id), status: r.status, created_at: r.created_at });
      }
      for (const r of (member ?? []) as Array<{ id: string; requested_by: string; company_id: string; investor_id: string | null; status: string; created_at: string }>) {
        requested++;
        if (r.status === "facilitated") introduced++;
        if (r.status === "requested" || r.status === "reviewing") introsToApprove.push({ kind: "member", id: r.id, company: name(r.company_id), investor: r.investor_id, plan: planOf(r.requested_by), status: r.status, created_at: r.created_at });
      }
    }
  }
  await resolveInvestorNames(introsToApprove);

  const cost = campaign.match_config.cost;
  const costUsd =
    cost && (cost.send_cost_usd != null || cost.admin_hours != null)
      ? (cost.send_cost_usd ?? 0) + (cost.admin_hours ?? 0) * (cost.hourly_rate_usd ?? 0)
      : null;
  const roi = costUsd && costUsd > 0 ? (revenueCents / 100 - costUsd) / costUsd : null;

  const breakdown = (key: (f: CampaignFounderRow) => string): BreakdownRow[] => {
    const m = new Map<string, BreakdownRow>();
    for (const f of founders) {
      const k = key(f);
      const row = m.get(k) ?? { key: k, emailed: 0, converted: 0 };
      row.emailed++;
      if (converted.has(f.id)) row.converted++;
      m.set(k, row);
    }
    return [...m.values()].sort((a, b) => b.emailed - a.emailed);
  };
  const typeLabel: Record<FounderType, string> = { lead: "Lead only", existing_user: "Existing user", in_pipeline: "In pipeline" };

  return {
    emailed: emailed.length,
    dryRun,
    opened: orNull(opened),
    pageOpened: orNull(founders.filter((f) => f.opened_page_at).length),
    callClicks: orNull(callers.length),
    booked: orNull(booked),
    introClicks: orNull(founders.filter((f) => f.clicked_intro_at).length),
    plans: orNull(plans),
    introsRequested: orNull(requested),
    introduced: orNull(introduced),
    revenueCents: plans > 0 ? revenueCents : null,
    costUsd,
    roi,
    byFounderType: breakdown((f) => (f.founder_type ? typeLabel[f.founder_type] : "Unknown")),
    byIndustry: breakdown((f) => f.industry?.split(", ")[0] || "Unknown"),
    byStage: breakdown((f) => f.funding_stage?.split(", ")[0] || "Unknown"),
    introsToApprove,
  };
}

/** Investor display names for the admin approval list (admin view only). */
async function resolveInvestorNames(rows: IntroToApprove[]): Promise<void> {
  const db = marketingDb();
  const prospectIds = rows.filter((r) => r.kind === "prospect" && r.investor?.startsWith("prospect:")).map((r) => (r.investor as string).slice(9));
  const memberIds = rows.filter((r) => r.kind === "member" && r.investor).map((r) => r.investor as string);
  const names = new Map<string, string>();
  if (prospectIds.length) {
    const { data } = await db.from("prospect_investors").select("id, name").in("id", prospectIds);
    for (const p of (data ?? []) as Array<{ id: string; name: string }>) names.set(`prospect:${p.id}`, p.name);
  }
  if (memberIds.length) {
    const { data } = await db.from("profiles").select("id, full_name, email").in("id", memberIds);
    for (const p of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) names.set(p.id, p.full_name || p.email || "Investor");
  }
  for (const r of rows) if (r.investor) r.investor = names.get(r.investor) ?? r.investor;
}
