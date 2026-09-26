/**
 * Weekly founder match email: for each paying founder's company, compare the
 * live matches (the same list /founder/matches shows) with the matches already
 * emailed, and send only when something is new. First run introduces the
 * current matches instead of calling all of them new.
 *
 * Best effort per company: one failure is logged and the run continues.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSubscription } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { loadFounderMatchingCenter } from "@/lib/matching/founder-matching-center";
import { crrFor } from "@/lib/crr/crr-for";
import { openRatingItems } from "@/lib/crr/open-items";
import { FACTOR_LABEL } from "@/lib/crr/weight-sets";
import { loadIntroQuota } from "@/lib/matching/intro-quota";
import { loadNotificationPrefs } from "@/lib/notifications/preferences";
import { sendTransactionalEmail } from "@/lib/email/transactional-send";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { newRefs, renderMatchDigestEmail } from "@/lib/matching/match-digest-email";
import type { Company } from "@/lib/supabase/types";

export type MatchDigestResult = {
  founders: number;
  companies: number;
  sent: number;
  skippedNothingNew: number;
  skippedPrefs: number;
  failed: number;
  dryRun: boolean;
  preview?: Array<{ companyId: string; to: string; subject: string }>;
};

export async function runFounderMatchDigest(opts: { dryRun?: boolean } = {}): Promise<MatchDigestResult> {
  const dryRun = Boolean(opts.dryRun);
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const result: MatchDigestResult = {
    founders: 0, companies: 0, sent: 0, skippedNothingNew: 0, skippedPrefs: 0, failed: 0, dryRun,
    ...(dryRun ? { preview: [] } : {}),
  };

  const { data: subs } = await admin.from("subscriptions").select("profile_id").eq("role", "founder");
  const founderIds = [...new Set(((subs ?? []) as Array<{ profile_id: string }>).map((s) => s.profile_id))];

  for (const founderId of founderIds) {
    const sub = await getSubscription(founderId);
    const plan = sub?.plan_type ?? null;
    // Paying founders only: active Basic, Professional, Managed IR. Internal
    // accounts are iCFO's own and are left out.
    if (!sub || sub.subscription_status !== "active" || plan === "admin_internal") continue;
    if (!founderEntitlements(plan).canDistribute) continue;
    result.founders += 1;

    const prefs = await loadNotificationPrefs(founderId);
    const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", founderId).maybeSingle();
    const email = (profile as { email?: string | null } | null)?.email ?? null;
    const fullName = ((profile as { full_name?: string | null } | null)?.full_name ?? "").trim();

    const { data: companies } = await admin
      .from("companies")
      .select("*")
      .eq("founder_id", founderId)
      .eq("is_sample", false);

    for (const company of (companies ?? []) as Company[]) {
      result.companies += 1;
      if (prefs.pause_all || !prefs.channel_email || !email || !email.includes("@")) {
        result.skippedPrefs += 1;
        continue;
      }
      try {
        const center = await loadFounderMatchingCenter(company);
        const currentRefs = center.cards.map((c) => c.ref);
        const { data: state } = await admin
          .from("founder_match_digest_state")
          .select("seen_refs, last_sent_at")
          .eq("company_id", company.id)
          .maybeSingle();
        const seen = ((state as { seen_refs?: string[] } | null)?.seen_refs ?? []) as string[];
        const firstEmail = !state;
        const fresh = new Set(newRefs(currentRefs, seen));
        if (!firstEmail && fresh.size === 0) {
          result.skippedNothingNew += 1;
          continue;
        }

        const crr = await crrFor(company.id);
        const listed = (firstEmail ? center.cards : center.cards.filter((c) => fresh.has(c.ref)))
          .slice()
          .sort((a, b) => b.matchScore - a.matchScore);

        let gate: Parameters<typeof renderMatchDigestEmail>[0]["gate"];
        if (crr.outreachUnlocked && founderEntitlements(plan).canBrokerIntros) {
          const quota = await loadIntroQuota(admin, { companyId: company.id, founderId, plan });
          gate = {
            unlocked: true,
            weekLeft: quota.week ? Math.max(0, quota.week.cap - quota.week.used) : null,
            monthLeft: Math.max(0, quota.month.cap - quota.month.used),
          };
        } else {
          const top = openRatingItems(crr.factorScores, FACTOR_LABEL, 1)[0];
          gate = {
            unlocked: false,
            score: crr.score,
            threshold: crr.gate,
            pointsToGate: crr.pointsToGate,
            openItem: top ? `${top.factor} · ${top.label}` : null,
          };
        }

        const rendered = renderMatchDigestEmail({
          firstName: fullName ? fullName.split(/\s+/)[0]! : null,
          companyName: company.company_name,
          totalMatches: center.total,
          newMatches: listed.map((c) => ({
            investorType: c.investorType,
            checkBand: c.checkBand,
            matchScore: c.matchScore,
            reasons: c.reasons,
          })),
          firstEmail,
          gate,
          matchesUrl: absoluteUrl("/founder/matches"),
          ratingUrl: absoluteUrl("/founder/readiness/wizard"),
        });

        if (dryRun) {
          result.preview!.push({ companyId: company.id, to: email, subject: rendered.subject });
          result.sent += 1;
          continue;
        }

        await sendTransactionalEmail({
          to: email,
          subject: rendered.subject,
          body: rendered.text,
          html: rendered.html,
          founderId,
          notificationType: "founder_match_digest",
          deepLink: "/founder/matches",
          entityType: "company",
          entityId: company.id,
          dedupeKey: `match-digest:${company.id}:${new Date().toISOString().slice(0, 10)}`,
        });

        await admin.from("founder_match_digest_state").upsert(
          {
            company_id: company.id,
            seen_refs: [...new Set([...seen, ...currentRefs])],
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" },
        );
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        console.error("[capitalos] match digest failed", {
          companyId: company.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  }

  return result;
}
