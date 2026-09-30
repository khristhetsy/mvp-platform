/**
 * Results for one Match campaign: measured counts only. A figure that is not measured
 * is returned as null and shown blank, never estimated.
 */
import "server-only";
import { marketingDb } from "@/lib/marketing/db";
import { PLAN_PRICES_CENTS } from "./plan-prices";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
const db = (): Db => marketingDb();

export type IntroToApprove = {
  kind: "prospect" | "member";
  id: string;
  company: string | null;
  investor: string | null;
  status: string;
  createdAt: string;
};

export type MatchResults = {
  emailed: number;
  dryRun: number;
  opened: number | null;
  clicked: number | null;
  pageOpened: number;
  callClicks: number;
  introClicks: number;
  signedUp: number;
  paid: number;
  revenue90dCents: number;
  introsRequested: number;
  introsCompleted: number;
  roi: number | null;
  costCents: number | null;
  intros: IntroToApprove[];
};

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export async function loadMatchResults(campaignId: string, costCents: number | null): Promise<MatchResults> {
  const { data: rows } = await db()
    .from("match_campaign_founders")
    .select("id, email, send_status, sent_at, opened_page_at, clicked_call_at, clicked_intro_at")
    .eq("campaign_id", campaignId)
    .in("send_status", ["sent", "dry_run"]);
  const sentRows = (rows ?? []) as Array<{ id: string; email: string | null; send_status: string; sent_at: string | null; opened_page_at: string | null; clicked_call_at: string | null; clicked_intro_at: string | null }>;
  const emailed = sentRows.filter((r) => r.send_status === "sent").length;
  const dryRun = sentRows.filter((r) => r.send_status === "dry_run").length;

  const eventCount = async (type: string): Promise<number | null> => {
    const { data, error } = await db().from("marketing_events").select("contact_id").eq("campaign_id", campaignId).eq("event_type", type);
    if (error) return null;
    return new Set(((data ?? []) as Array<{ contact_id: string }>).map((d) => d.contact_id)).size;
  };
  const [opened, clicked] = emailed ? await Promise.all([eventCount("opened"), eventCount("clicked")]) : [null, null];

  // Founders who signed up afterwards: a profile with the same email, created after the send.
  const byEmail = new Map(sentRows.filter((r) => r.email).map((r) => [String(r.email).toLowerCase(), r]));
  const profiles: Array<{ id: string; email: string }> = [];
  for (const part of chunk([...byEmail.keys()], 300)) {
    const { data } = await db().from("profiles").select("id, email, created_at").in("email", part);
    for (const p of (data ?? []) as Array<{ id: string; email: string; created_at: string }>) {
      const r = byEmail.get(p.email.toLowerCase());
      if (r?.sent_at && p.created_at >= r.sent_at) profiles.push({ id: p.id, email: p.email });
    }
  }
  const profileIds = profiles.map((p) => p.id);

  let paid = 0;
  let revenue90dCents = 0;
  const now = Date.now();
  if (profileIds.length) {
    const { data: subs } = await db().from("subscriptions").select("profile_id, plan_type, subscription_status, created_at, monthly_price_cents").in("profile_id", profileIds);
    const paidPlans = new Set(Object.keys(PLAN_PRICES_CENTS));
    for (const s of (subs ?? []) as Array<{ profile_id: string; plan_type: string | null; subscription_status: string | null; created_at: string; monthly_price_cents: number | null }>) {
      if (!s.plan_type || !paidPlans.has(s.plan_type) || s.subscription_status !== "active") continue;
      paid += 1;
      const price = s.monthly_price_cents ?? PLAN_PRICES_CENTS[s.plan_type] ?? 0;
      const days = Math.min(90, Math.max(0, (now - new Date(s.created_at).getTime()) / 86_400_000));
      revenue90dCents += price * Math.max(1, Math.ceil(days / 30));
    }
  }

  // Introductions requested by those founders, through the existing brokered workflow.
  const intros: IntroToApprove[] = [];
  let introsRequested = 0;
  let introsCompleted = 0;
  if (profileIds.length) {
    const [prospect, companies] = await Promise.all([
      db().from("prospect_intro_requests").select("id, status, created_at, investor_ref, company:companies(company_name)").in("founder_id", profileIds),
      db().from("companies").select("id").in("founder_id", profileIds),
    ]);
    for (const r of (prospect.data ?? []) as Array<{ id: string; status: string; created_at: string; investor_ref: string; company: { company_name: string | null } | null }>) {
      introsRequested += 1;
      if (r.status === "contacted") introsCompleted += 1;
      if (r.status === "new") intros.push({ kind: "prospect", id: r.id, company: r.company?.company_name ?? null, investor: null, status: r.status, createdAt: r.created_at });
    }
    const companyIds = ((companies.data ?? []) as Array<{ id: string }>).map((c) => c.id);
    if (companyIds.length) {
      const { data: member } = await db().from("intro_requests").select("id, status, created_at, company:companies(company_name)").in("company_id", companyIds).eq("direction", "founder_to_investor");
      for (const r of (member ?? []) as Array<{ id: string; status: string; created_at: string; company: { company_name: string | null } | null }>) {
        introsRequested += 1;
        if (r.status === "facilitated") introsCompleted += 1;
        if (r.status === "requested" || r.status === "reviewing") intros.push({ kind: "member", id: r.id, company: r.company?.company_name ?? null, investor: null, status: r.status, createdAt: r.created_at });
      }
    }
  }

  return {
    emailed,
    dryRun,
    opened,
    clicked,
    pageOpened: sentRows.filter((r) => r.opened_page_at).length,
    callClicks: sentRows.filter((r) => r.clicked_call_at).length,
    introClicks: sentRows.filter((r) => r.clicked_intro_at).length,
    signedUp: profiles.length,
    paid,
    revenue90dCents,
    introsRequested,
    introsCompleted,
    costCents,
    roi: costCents && costCents > 0 ? (revenue90dCents - costCents) / costCents : null,
    intros: intros.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
