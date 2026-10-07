/**
 * Per company outreach and intro request allowance for the admin Companies
 * list: the founder's current 30 day window, investors reached against the
 * plan limit, a status, and intro requests used against the plan limit.
 * Reads through the same helpers that enforce the limits, so the list shows
 * the numbers founders are held to. Only paid founders (plans that distribute).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import type { PlanType } from "@/lib/subscriptions/plans";
import { founderCapPeriod, reachedInPeriod } from "@/lib/outreach/investor-cap";
import { getNextOutreachBatch } from "@/lib/outreach/outreach-next-batch";
import { loadIntroQuota } from "@/lib/matching/intro-quota";
import { allowanceStatus, type AllowanceStatus } from "@/lib/outreach/allowance-status";

export type CompanyAllowance = {
  windowStart: string;
  windowEnd: string;
  /** Day of the 30 day window, 1 to 30. */
  day: number;
  cap: number | null;
  reached: number;
  status: AllowanceStatus;
  /** Short explanation under the status: next run, queue size, block reason. */
  note: string;
  intros: { used: number; cap: number } | null;
};

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export async function getCompanyAllowances(
  rows: Array<{ companyId: string; founderId: string | null; plan: PlanType | null | undefined }>,
): Promise<Record<string, CompanyAllowance>> {
  const out: Record<string, CompanyAllowance> = {};
  const paid = rows.filter((r) => r.founderId && founderEntitlements(r.plan ?? null).canDistribute && r.plan !== "admin_internal");
  if (paid.length === 0) return out;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;

  await Promise.all(paid.map(async (r) => {
    try {
      const founderId = r.founderId as string;
      const ent = founderEntitlements(r.plan ?? null);
      const period = await founderCapPeriod(db, founderId);
      const [reachedSet, batch, quota, campaign] = await Promise.all([
        reachedInPeriod(db, r.companyId, period.start),
        getNextOutreachBatch(r.companyId),
        loadIntroQuota(db as SupabaseClient, { companyId: r.companyId, founderId, plan: r.plan ?? null }).catch(() => null),
        db.from("investor_outreach_campaigns").select("id, paused").eq("company_id", r.companyId).maybeSingle(),
      ]);
      const reached = reachedSet.size;
      const camp = campaign?.data as { id: string; paused: boolean } | null;

      let queued = 0;
      if (camp) {
        const { count } = await db.from("investor_outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", camp.id).eq("status", "queued");
        queued = count ?? 0;
      }

      const blockedReason =
        batch?.blocked === "unpublished" ? "Profile not published"
        : !camp ? "No outreach campaign"
        : camp.paused ? "Campaign paused"
        : !batch ? "Automation paused or off"
        : null;
      const nextRunAt = batch && batch.blocked !== "cap_reached" ? batch.runAt : null;
      const { status } = allowanceStatus({
        cap: ent.investorCap, reached, windowEnd: period.end, nextRunAt,
        perRun: batch?.upTo ?? 0, blockedReason,
      });

      const note =
        status === "full" ? `Resets ${fmt(period.end)}`
        : status === "stalled" ? (blockedReason ?? "Nothing scheduled")
        : `${queued ? `${queued} queued · ` : ""}next ${nextRunAt ? fmt(nextRunAt) : "run not set"}`;

      out[r.companyId] = {
        windowStart: period.start.toISOString(),
        windowEnd: period.end.toISOString(),
        day: Math.min(30, Math.max(1, Math.floor((Date.now() - period.start.getTime()) / 86_400_000) + 1)),
        cap: ent.investorCap,
        reached,
        status,
        note,
        intros: quota ? { used: quota.month.used, cap: quota.month.cap } : null,
      };
    } catch {
      /* one company never breaks the list */
    }
  }));
  return out;
}
