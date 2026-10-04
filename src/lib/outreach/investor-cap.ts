/**
 * Plan limit on investors a founder reaches with outreach.
 *
 * Basic reaches up to 5 investors and Professional up to 50 (founderEntitlements
 * investorCap); Managed IR is uncapped; Free reaches none. The allowance resets
 * every 30 days, counted from the founder's signup date, not the calendar month.
 *
 * One allowance is shared by DIY outreach (counted when an investor is first
 * enrolled) and automated outreach (counted when the one-pager is sent), keyed
 * by investor email, so the same investor reached both ways counts once.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import type { PlanType } from "@/lib/subscriptions/plans";

export const CAP_PERIOD_DAYS = 30;
const DAY_MS = 86_400_000;

/** Postgres "timestamp without time zone" values come back without an offset: read them as UTC. */
export function parseUtc(ts: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`);
}

/** The 30 day window containing `now`, anchored to signup. */
export function capPeriod(signupAt: Date, now: Date = new Date()): { start: Date; end: Date } {
  const elapsed = Math.max(0, now.getTime() - signupAt.getTime());
  const k = Math.floor(elapsed / (CAP_PERIOD_DAYS * DAY_MS));
  const start = new Date(signupAt.getTime() + k * CAP_PERIOD_DAYS * DAY_MS);
  return { start, end: new Date(start.getTime() + CAP_PERIOD_DAYS * DAY_MS) };
}

export type CapDecision =
  | { ok: true }
  | { ok: false; cap: number; used: number; remaining: number; resetsAt: Date };

/** Pure: may `adding` new investors be reached when `used` already were this period? cap null = uncapped. */
export function decideCap(cap: number | null, used: number, adding: number, resetsAt: Date): CapDecision {
  if (cap === null || adding <= 0) return { ok: true };
  const remaining = Math.max(0, cap - used);
  return adding <= remaining ? { ok: true } : { ok: false, cap, used, remaining, resetsAt };
}

export function capMessage(d: Extract<CapDecision, { ok: false }>): string {
  const reset = d.resetsAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const room = d.remaining > 0 ? `you can add ${d.remaining} more` : "you can't add more";
  return `Your plan reaches up to ${d.cap} investors every 30 days. You've reached ${d.used}, so ${room} until ${reset}.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** The founder's current 30 day period, from their profile's signup date. */
export async function founderCapPeriod(db: Db, founderId: string, now: Date = new Date()): Promise<{ start: Date; end: Date }> {
  const { data: prof } = await db.from("profiles").select("created_at").eq("id", founderId).maybeSingle();
  const signup = prof?.created_at ? parseUtc(String(prof.created_at)) : now;
  return capPeriod(signup, now);
}

function investorKey(email: string | null | undefined, fallback: string): string {
  const e = email?.trim().toLowerCase();
  return e ? `e:${e}` : `r:${fallback}`;
}

/** Investors this company reached since `start`, across DIY and automated outreach. */
export async function reachedInPeriod(db: Db, companyId: string, start: Date): Promise<Set<string>> {
  const since = start.toISOString();
  const [{ data: diy }, { data: campaigns }] = await Promise.all([
    db.from("founder_manual_outreach_recipients").select("contact_id, email").eq("company_id", companyId).gte("enrolled_at", since),
    db.from("investor_outreach_campaigns").select("id").eq("company_id", companyId),
  ]);
  const keys = new Set<string>();
  for (const r of (diy ?? []) as Array<{ contact_id: string; email: string | null }>) keys.add(investorKey(r.email, `diy:${r.contact_id}`));
  const ids = ((campaigns ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (ids.length) {
    const { data: sent } = await db
      .from("investor_outreach_recipients")
      .select("investor_ref, email")
      .in("campaign_id", ids)
      .eq("status", "sent")
      .gte("sent_at", since);
    for (const r of (sent ?? []) as Array<{ investor_ref: string; email: string | null }>) keys.add(investorKey(r.email, `auto:${r.investor_ref}`));
  }
  return keys;
}

/**
 * Pure: the period ceiling for automated outreach. An admin's explicit
 * per-founder cap replaces everything. Otherwise the lower of the plan limit and
 * the admin's automation setting for the plan, so lowering that setting still
 * slows sends but raising it never passes the plan. null = no ceiling.
 */
export function automatedCeiling(input: { planCap: number | null; adminPlanCap: number | null; capOverride: number | null }): number | null {
  if (input.capOverride !== null) return input.capOverride;
  if (input.planCap === null) return input.adminPlanCap;
  if (input.adminPlanCap === null) return input.planCap;
  return Math.min(input.planCap, input.adminPlanCap);
}

/** Pure: how many automated sends this run may make. */
export function automatedRunLimit(ceiling: number | null, reached: number, weeklyCap: number): number {
  if (ceiling === null) return Math.max(0, weeklyCap);
  return Math.max(0, Math.min(weeklyCap, ceiling - reached));
}

/**
 * Checks a DIY outreach start: counts the selected investors not yet enrolled
 * (with an email, since email-less contacts are never enrolled) against what
 * is left of this period's allowance.
 */
export async function checkManualOutreachCap(input: {
  founderId: string;
  companyId: string;
  plan: PlanType | null;
  selectedIds: readonly string[];
  now?: Date;
}): Promise<CapDecision> {
  const cap = founderEntitlements(input.plan).investorCap;
  if (cap === null) return { ok: true };
  const now = input.now ?? new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const period = await founderCapPeriod(db, input.founderId, now);
  const reached = await reachedInPeriod(db, input.companyId, period.start);
  const used = reached.size;

  const selected = [...new Set(input.selectedIds)];
  let adding = 0;
  if (selected.length) {
    const [{ data: enrolled }, { data: contacts }] = await Promise.all([
      db.from("founder_manual_outreach_recipients").select("contact_id").eq("company_id", input.companyId).in("contact_id", selected),
      db.from("founder_investor_contacts").select("id, email").eq("company_id", input.companyId).in("id", selected),
    ]);
    const already = new Set(((enrolled ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id));
    adding = ((contacts ?? []) as Array<{ id: string; email: string | null }>).filter(
      (c) => !already.has(c.id) && c.email && c.email.trim() && !reached.has(investorKey(c.email, "")),
    ).length;
  }
  return decideCap(cap, used, adding, period.end);
}
