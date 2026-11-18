// Weekly "Connect with investors" reminder for paid founders who have not connected
// a social account. In-app note plus a short email, at most one a week per founder.
// Uses the same rules as the home banner (connect-nudge-rules.ts), so a founder who
// connects, closes the banner twice, or is snoozed stops getting it, and the admin
// switch (Feature Controls, Social Media nudge) turns the whole pass off. The email
// goes through sendEmail, so the founder email budget (daily or weekly digest) applies.
// Best effort: never throws into the cron.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { NOT_A_BROKER_DEALER, renderEmail, type RenderedEmail } from "@/lib/email/layout";
import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { loadConnectNudgeFacts } from "@/lib/social/connect-nudge";
import {
  CONNECT_PATH,
  NUDGE_FEATURE,
  NUDGE_NOTIFICATION_TYPE,
  NUDGE_PLANS,
  shouldShowConnectNudge,
} from "@/lib/social/connect-nudge-rules";

const DEDUPE_HOURS = 24 * 7; // at most one a week
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");

/** The reminder email. Pure. */
export function socialConnectNudgeEmail(firstName: string | null): RenderedEmail {
  return renderEmail({
    audience: "founder",
    subject: "Connect with investors",
    preheader: "Connect LinkedIn and approve one ready post.",
    eyebrow: "Your raise · Social media",
    headline: "Build an investor network that fits your raise",
    intro: `${firstName ? `Hi ${firstName}, ` : ""}connect LinkedIn and approve one ready post. Investors who match your sector and stage can then find you and connect. Nothing is posted until you approve it.`,
    primary: { label: "Connect with investors", url: `${SITE_URL}${CONNECT_PATH}` },
    footer: {
      reason: "You get this because your plan includes social media and you have not connected an account yet. At most one a week.",
      preferencesUrl: `${SITE_URL}/founder/settings`,
      lines: [NOT_A_BROKER_DEALER],
    },
  });
}

type SubRow = { profile_id: string };
type ProfileRow = { id: string; email: string | null; full_name: string | null; role: string | null };

export async function runSocialConnectNudgePass(): Promise<{ checked: number; sent: number }> {
  let checked = 0;
  let sent = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    const flags = await loadFeatureFlags(db);
    if (!isFeatureEnabled(flags, "founder", NUDGE_FEATURE)) return { checked, sent };

    const { data: subs } = await db
      .from("subscriptions")
      .select("profile_id")
      .in("plan_type", [...NUDGE_PLANS])
      .eq("subscription_status", "active")
      .limit(1000);
    const ids = ((subs ?? []) as SubRow[]).map((s) => s.profile_id);
    if (ids.length === 0) return { checked, sent };

    const { data: profs } = await db.from("profiles").select("id, email, full_name, role").in("id", ids);
    const founders = ((profs ?? []) as ProfileRow[]).filter((p) => p.role === "founder" && !isInternalAccount(p));

    for (const f of founders) {
      checked += 1;
      const facts = await loadConnectNudgeFacts(f.id, true);
      if (!facts || !shouldShowConnectNudge(facts)) continue;
      if (await hasRecentNotification({ recipientUserId: f.id, type: NUDGE_NOTIFICATION_TYPE, withinHours: DEDUPE_HOURS })) continue;

      await createNotification({
        recipientUserId: f.id,
        type: NUDGE_NOTIFICATION_TYPE,
        title: "Connect with investors",
        message: "Connect LinkedIn and approve one ready post to grow an investor network that fits your raise.",
        entityType: "social",
        entityId: null,
        deepLink: CONNECT_PATH,
      });
      if (f.email) {
        const mail = socialConnectNudgeEmail(f.full_name?.split(" ")[0] ?? null);
        await sendEmail({ to: f.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
      }
      sent += 1;
    }
  } catch {
    /* best effort: a nudge must never break the cron */
  }
  return { checked, sent };
}
