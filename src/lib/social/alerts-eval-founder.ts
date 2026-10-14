/**
 * Founder change alerts. Same rules and math as the iCFO alerts, but each rule reads
 * only that founder's campaigns and notifies only that founder. Runs from the hourly
 * social maintenance cron.
 */
import { campaignFunnels, aggregateFunnels, blendedPct, periodStart, periodElapsed, type Grain } from "./funnel";
import { alertMessage, shouldFire, snapshotFor } from "./alerts-eval";
import type { AlertRule } from "./goals-io";
import { getFounderSocialUsage } from "./founder-limits";
import { createNotification } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import { renderEmail } from "@/lib/email/layout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { logFounderSocialEvent } from "./activity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

type FounderRule = AlertRule & { owner_profile_id: string; last_fired_at: string | null };
const PATH = "/founder/deploy/social?tab=campaigns";

export async function evaluateFounderAlertRules(now = new Date()): Promise<{ founders: number; evaluated: number; fired: number }> {
  const { data, error } = await db().from("social_alert_rules")
    .select("id, owner_profile_id, metric, direction, threshold_pct, grain, channel, campaign_id, enabled, last_fired_at")
    .eq("enabled", true).not("owner_profile_id", "is", null);
  if (error) throw new Error(`Founder alert rules lookup failed: ${error.message}`);
  const rules = ((data ?? []) as FounderRule[]).map((r) => ({ ...r, threshold_pct: Number(r.threshold_pct) }));
  const byFounder = new Map<string, FounderRule[]>();
  for (const r of rules) byFounder.set(r.owner_profile_id, [...(byFounder.get(r.owner_profile_id) ?? []), r]);

  let evaluated = 0; let fired = 0;
  for (const [founderId, founderRules] of byFounder) {
    // A founder whose plan no longer includes social media gets no alerts.
    const usage = await getFounderSocialUsage(founderId, now).catch(() => null);
    if (!usage?.enabled) continue;
    const { data: prof } = await db().from("profiles").select("email").eq("id", founderId).maybeSingle();
    const email = (prof?.email as string | null) ?? null;

    const grains = [...new Set(founderRules.map((r) => r.grain))] as Grain[];
    for (const grain of grains) {
      const funnels = await campaignFunnels(grain, now, founderId);
      const agg = aggregateFunnels(funnels);
      const blended = blendedPct(agg);
      const start = periodStart(grain, now);
      const elapsed = periodElapsed(grain, start, now);
      const byCampaign = new Map(funnels.map((f) => [f.campaignId, f]));

      for (const rule of founderRules.filter((r) => r.grain === grain)) {
        evaluated += 1;
        let stages = agg; let ruleBlended = blended; let campaignName: string | null = null;
        if (rule.campaign_id) {
          const f = byCampaign.get(rule.campaign_id);
          if (!f) continue;
          stages = f.stages; ruleBlended = blendedPct(f.stages); campaignName = f.name;
        }
        const snap = snapshotFor(rule, stages, ruleBlended, elapsed, 0, null);
        if (!shouldFire(rule.direction, rule.threshold_pct, snap)) continue;
        if (rule.last_fired_at && new Date(rule.last_fired_at) >= start) continue;

        const scope = campaignName ? `${campaignName}: ` : "";
        const title = `Social: ${scope}${rule.metric.replace("_", " ")} ${rule.direction === "behind_pace" ? "behind pace" : rule.direction}`;
        const message = `${scope}${alertMessage(rule, snap)}`;
        if (rule.channel === "in_app" || rule.channel === "both") {
          await createNotification({
            recipientUserId: founderId, type: "social_alert", title, message,
            entityType: "social_alert_rule", entityId: rule.id,
            severity: rule.direction === "up" ? "info" : "warning", deepLink: PATH,
            dedupeKey: `founder_social_alert:${rule.id}:${start.toISOString().slice(0, 10)}`,
          });
        }
        if ((rule.channel === "email" || rule.channel === "both") && email) {
          const mail = renderEmail({
            audience: "founder", subject: title, preheader: message, context: "Social media",
            eyebrow: rule.direction === "up" ? "Social alert" : "Social alert, needs attention",
            headline: title, intro: message,
            primary: { label: "Open Social media", url: PATH },
            footer: { reason: "You're receiving this because one of your Social media alert rules matched." },
          });
          await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => false);
        }
        await db().from("social_alert_rules").update({ last_fired_at: now.toISOString() }).eq("id", rule.id);
        await logFounderSocialEvent({
          type: "founder.social_alert_fired", founderId, description: title,
          metadata: { ruleId: rule.id, metric: rule.metric, direction: rule.direction },
          dedupeKey: `founder_social_alert_fired:${rule.id}:${start.toISOString().slice(0, 10)}`,
        });
        fired += 1;
      }
    }
  }
  return { founders: byFounder.size, evaluated, fired };
}
