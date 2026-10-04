/**
 * Plan limit on investors a founder reaches with their own (DIY) outreach.
 *
 * Basic reaches up to 5 investors and Professional up to 50 (founderEntitlements
 * investorCap); Managed IR is uncapped. The allowance resets every 30 days,
 * counted from the founder's signup date, not the calendar month. An investor
 * counts once, when first enrolled in the founder's outreach; continuing a
 * sequence to someone already reached never uses the allowance again.
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
  const { data: prof } = await db.from("profiles").select("created_at").eq("id", input.founderId).maybeSingle();
  const signup = prof?.created_at ? parseUtc(String(prof.created_at)) : now;
  const period = capPeriod(signup, now);

  const { count } = await db
    .from("founder_manual_outreach_recipients")
    .select("id", { count: "exact", head: true })
    .eq("company_id", input.companyId)
    .gte("enrolled_at", period.start.toISOString());
  const used = count ?? 0;

  const selected = [...new Set(input.selectedIds)];
  let adding = 0;
  if (selected.length) {
    const [{ data: enrolled }, { data: contacts }] = await Promise.all([
      db.from("founder_manual_outreach_recipients").select("contact_id").eq("company_id", input.companyId).in("contact_id", selected),
      db.from("founder_investor_contacts").select("id, email").eq("company_id", input.companyId).in("id", selected),
    ]);
    const already = new Set(((enrolled ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id));
    adding = ((contacts ?? []) as Array<{ id: string; email: string | null }>).filter((c) => !already.has(c.id) && c.email && c.email.trim()).length;
  }
  return decideCap(cap, used, adding, period.end);
}
