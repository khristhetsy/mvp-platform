/**
 * Held drafts: a founder at the monthly limit can save a post as a draft for the reset
 * date. On that date this pass tells them their limit is back and releases the drafts to
 * plain drafts. Nothing here ever schedules or publishes a post.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import { renderEmail } from "@/lib/email/layout";
import { logFounderSocialEvent } from "@/lib/social/activity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type HeldReleaseResult = { founders: number; drafts: number };

const PATH = "/founder/deploy/social?tab=library";

export async function releaseHeldDrafts(now = new Date()): Promise<HeldReleaseResult> {
  const { data, error } = await db().from("social_posts")
    .select("id, owner_profile_id")
    .not("owner_profile_id", "is", null)
    .not("held_until", "is", null)
    .lte("held_until", now.toISOString())
    .eq("status", "draft")
    .is("deleted_at", null)
    .limit(2000);
  if (error) throw new Error(`Held drafts lookup failed: ${error.message}`);

  const byFounder = new Map<string, string[]>();
  for (const r of (data ?? []) as { id: string; owner_profile_id: string }[]) {
    const list = byFounder.get(r.owner_profile_id) ?? [];
    list.push(r.id);
    byFounder.set(r.owner_profile_id, list);
  }

  let drafts = 0;
  for (const [founderId, ids] of byFounder) {
    // Clear the hold first so a failed reminder can never repeat every hour.
    const { error: upErr } = await db().from("social_posts").update({ held_until: null }).in("id", ids).eq("owner_profile_id", founderId);
    if (upErr) continue;
    drafts += ids.length;

    const noun = ids.length === 1 ? "draft is" : "drafts are";
    const message = `Your monthly post limit has reset. ${ids.length} saved ${noun} ready to review and schedule. Nothing posts until you schedule it.`;
    await createNotification({
      recipientUserId: founderId,
      type: "founder_social_drafts_ready",
      title: "Your saved social drafts are ready",
      message,
      entityType: "social_post",
      entityId: ids[0],
      severity: "info",
      deepLink: PATH,
      dedupeKey: `founder_social_held:${founderId}:${now.toISOString().slice(0, 10)}`,
    });

    try {
      const { data: prof } = await db().from("profiles").select("email, full_name").eq("id", founderId).maybeSingle();
      const email = (prof?.email as string | null) ?? null;
      if (email) {
        const mail = renderEmail({
          audience: "founder",
          subject: "Your saved social drafts are ready",
          preheader: message,
          context: "Social media",
          eyebrow: "Posting limit reset",
          headline: "Your saved drafts are ready",
          intro: message,
          primary: { label: "Open your drafts", url: PATH },
          footer: { reason: "You're receiving this because you saved posts as drafts for your next posting cycle." },
        });
        await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => false);
      }
    } catch { /* the in-app reminder already went out */ }

    await logFounderSocialEvent({
      type: "founder.social_drafts_released", founderId,
      description: `${ids.length} saved ${ids.length === 1 ? "draft" : "drafts"} released after the limit reset`,
      metadata: { count: ids.length },
      dedupeKey: `founder_social_released:${founderId}:${now.toISOString().slice(0, 10)}`,
    });
  }
  return { founders: byFounder.size, drafts };
}
