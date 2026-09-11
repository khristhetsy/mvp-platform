/**
 * Evaluate social change-alert rules and notify staff. Called from the social-queue
 * cron (every 5 min) and can be triggered at period close.
 *
 * For each enabled rule we compute the metric's movement for the rule's grain:
 *   up / down     → percent change vs the previous comparable period
 *   behind_pace   → attainment (blended % of goal) as a fraction of elapsed pace
 * A rule fires at most once per period (guarded by last_fired_at) and is deduped per
 * staff recipient via notifyStaffIfNotRecent.
 */
import { campaignFunnels, aggregateFunnels, blendedPct, periodStart, prevPeriodStart, periodElapsed, type Grain, type StageKey, type StageResult } from "./funnel";
import { listAlertRules, type AlertRule } from "./goals-io";
import { notifyStaffIfNotRecent } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const STAGE_METRICS: StageKey[] = ["outreach", "clicks", "meetings", "conversions"];

export type MetricSnapshot = {
  /** % change vs previous comparable period (null when previous is 0). */
  deltaPct: number | null;
  /** Attainment as a % of where pacing says we should be (blended% ÷ elapsed×100 × 100). */
  paceRatioPct: number | null;
};

/** Pure decision: does this rule fire given the metric snapshot? */
export function shouldFire(direction: AlertRule["direction"], thresholdPct: number, snap: MetricSnapshot): boolean {
  if (direction === "up") return snap.deltaPct !== null && snap.deltaPct >= thresholdPct;
  if (direction === "down") return snap.deltaPct !== null && snap.deltaPct <= -thresholdPct;
  // behind_pace: attainment has fallen below threshold% of the expected pace.
  return snap.paceRatioPct !== null && snap.paceRatioPct < thresholdPct;
}

/** Human-readable line for the notification. */
export function alertMessage(rule: AlertRule, snap: MetricSnapshot): string {
  const m = rule.metric.replace("_", " ");
  if (rule.direction === "behind_pace") return `${m} pacing is at ${Math.round(snap.paceRatioPct ?? 0)}% of where it should be for this ${rule.grain}.`;
  const dir = rule.direction === "up" ? "rose" : "dropped";
  return `${m} ${dir} ${Math.abs(snap.deltaPct ?? 0)}% vs the previous ${rule.grain}.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type AlertEvalResult = { evaluated: number; fired: number };

/** Build the snapshot for a rule's metric from the grain's aggregate + pacing. */
function snapshotFor(rule: AlertRule, agg: StageResult[], blended: number | null, elapsed: number, revenueNow: number, revenuePrev: number | null): MetricSnapshot {
  const paceTarget = elapsed * 100;
  const paceRatioPct = blended !== null && paceTarget > 0 ? (blended / paceTarget) * 100 : null;
  if (rule.metric === "goal_pacing") return { deltaPct: null, paceRatioPct };
  if (rule.metric === "revenue") {
    const deltaPct = revenuePrev && revenuePrev > 0 ? Math.round(((revenueNow - revenuePrev) / revenuePrev) * 1000) / 10 : null;
    return { deltaPct, paceRatioPct };
  }
  if ((STAGE_METRICS as string[]).includes(rule.metric)) {
    const s = agg.find((x) => x.stage === rule.metric);
    return { deltaPct: s?.deltaPct ?? null, paceRatioPct };
  }
  return { deltaPct: null, paceRatioPct };
}

/** Staff email addresses (admin/analyst) — for rules whose channel includes email. */
async function staffEmails(): Promise<string[]> {
  const { data } = await db().from("profiles").select("email").in("role", ["admin", "analyst"]);
  return [...new Set(((data ?? []) as { email: string | null }[]).map((r) => (r.email ?? "").trim()).filter((e) => e.includes("@")))];
}

export async function evaluateAlertRules(now = new Date()): Promise<AlertEvalResult> {
  const rules = (await listAlertRules()).filter((r) => r.enabled);
  if (!rules.length) return { evaluated: 0, fired: 0 };

  const grains = [...new Set(rules.map((r) => r.grain))] as Grain[];
  // Fetch staff emails once, only if some rule wants email delivery.
  const emails = rules.some((r) => r.channel === "email" || r.channel === "both") ? await staffEmails() : [];
  let fired = 0;

  for (const grain of grains) {
    const grainRules = rules.filter((r) => r.grain === grain);
    const funnels = await campaignFunnels(grain, now);
    const agg = aggregateFunnels(funnels);
    const blended = blendedPct(agg);
    const start = periodStart(grain, now);
    const elapsed = periodElapsed(grain, start, now);
    const revenueNow = funnels.reduce((a, f) => a + f.revenueCents, 0);
    const byCampaign = new Map(funnels.map((f) => [f.campaignId, f]));

    // Previous-period funnels are needed for any revenue rule (account-wide or per-campaign).
    let revenuePrev: number | null = null;
    const prevRevByCampaign = new Map<string, number>();
    if (grainRules.some((r) => r.metric === "revenue")) {
      const prevFunnels = await campaignFunnels(grain, prevPeriodStart(grain, start));
      revenuePrev = prevFunnels.reduce((a, f) => a + f.revenueCents, 0);
      for (const f of prevFunnels) prevRevByCampaign.set(f.campaignId, f.revenueCents);
    }

    for (const rule of grainRules) {
      // Per-campaign rules read that campaign's funnel; account-wide rules read the aggregate.
      let stages = agg, ruleBlended = blended, revNow = revenueNow, revPrev = revenuePrev, campaignName: string | null = null;
      if (rule.campaign_id) {
        const f = byCampaign.get(rule.campaign_id);
        if (!f) continue; // campaign archived/gone
        stages = f.stages; ruleBlended = blendedPct(f.stages); revNow = f.revenueCents;
        revPrev = prevRevByCampaign.has(f.campaignId) ? prevRevByCampaign.get(f.campaignId)! : null;
        campaignName = f.name;
      }
      const snap = snapshotFor(rule, stages, ruleBlended, elapsed, revNow, revPrev);
      if (!shouldFire(rule.direction, rule.threshold_pct, snap)) continue;

      const { data: row } = await db().from("social_alert_rules").select("last_fired_at").eq("id", rule.id).maybeSingle();
      const lastFired = row?.last_fired_at ? new Date(row.last_fired_at) : null;
      if (lastFired && lastFired >= start) continue; // already fired this period

      const scope = campaignName ? `${campaignName}: ` : "";
      const title = `Social: ${scope}${rule.metric.replace("_", " ")} ${rule.direction === "behind_pace" ? "behind pace" : rule.direction}`;
      const message = `${scope}${alertMessage(rule, snap)}`;
      await notifyStaffIfNotRecent({
        type: "social_alert",
        title,
        message,
        entityType: "social_alert_rule",
        entityId: rule.id,
        severity: rule.direction === "up" ? "info" : "warning",
        deepLink: "/admin/social",
        withinHours: 24,
      });
      if ((rule.channel === "email" || rule.channel === "both") && emails.length) {
        const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://icapos.com";
        await sendEmail({
          to: emails,
          subject: `iCapOS · ${title}`,
          html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#0f172a"><p>${message}</p><p><a href="${base}/admin/social" style="color:#4338CA">Open the Social Media Hub →</a></p><p style="color:#94a3b8;font-size:12px">You're receiving this because a Social Hub alert rule matched.</p></div>`,
        }).catch(() => false);
      }
      await db().from("social_alert_rules").update({ last_fired_at: now.toISOString() }).eq("id", rule.id);
      fired += 1;
    }
  }
  return { evaluated: rules.length, fired };
}
