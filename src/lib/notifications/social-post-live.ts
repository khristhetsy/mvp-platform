// Tells a founder their social post is live: one bell alert and one short email per post
// and account, sent the moment the queue publishes it. Failed posts are NOT sent here, by
// design: a failure stays a staff alert (see reportFounderFailure in lib/social/queue.ts).
//
// Rules, all in one place:
//   - Founders only. A post with no owner (staff posts on iCFO accounts) notifies nobody.
//   - The founder's own switches apply (Settings, Email, Social media alerts). Both default on.
//   - Internal and demo accounts get the bell alert only, never the email.
//   - The email honors quiet hours and goes through sendEmail, so the founder email budget applies.
//   - The link opens the live post when the network returned one, otherwise Your posts.
// Best effort: never throws into the publish queue.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { NOT_A_BROKER_DEALER, renderEmail, type RenderedEmail } from "@/lib/email/layout";
import { createNotification } from "@/lib/notifications/notifications";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { shouldSendEmail } from "@/lib/notifications/preferences";

export const POST_LIVE_NOTIFICATION_TYPE = "social_post_published";
export const POSTS_PATH = "/founder/deploy/social";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");

const NETWORK_NAMES: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
};

/** "linkedin" becomes "LinkedIn". An unknown network is shown as the platform name it came with. */
export function networkName(platform: string | null | undefined): string {
  const key = (platform ?? "").trim().toLowerCase();
  if (!key) return "your account";
  return NETWORK_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Only a real web address is ever linked. Anything else falls back to Your posts. */
export function liveLink(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  return /^https?:\/\//i.test(u) ? u : null;
}

/** Pure: the text of the bell alert. */
export function postLiveCopy(input: { platform: string | null; title: string }): { title: string; message: string } {
  const net = networkName(input.platform);
  return { title: `Your post is live on ${net}`, message: input.title.trim().slice(0, 200) || "Your social post" };
}

const PT_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Pure: the email. */
export function postLiveEmail(input: {
  firstName: string | null;
  platform: string | null;
  title: string;
  url: string | null;
  publishedAt: Date;
}): RenderedEmail {
  const net = networkName(input.platform);
  const link = liveLink(input.url);
  const title = input.title.trim().slice(0, 200) || "Your social post";
  return renderEmail({
    audience: "founder",
    subject: `Your ${net} post is live`,
    preheader: title,
    eyebrow: "Your raise · Social media",
    headline: `Your post is live on ${net}`,
    intro: `${input.firstName ? `Hi ${input.firstName}, ` : ""}your scheduled post went out on ${PT_FORMAT.format(input.publishedAt)} PT.`,
    blocks: [{ type: "quote", label: net, text: title }],
    primary: link
      ? { label: `View on ${net}`, url: link }
      : { label: "See your posts", url: `${SITE_URL}${POSTS_PATH}` },
    secondary: link ? { label: "Your posts", url: `${SITE_URL}${POSTS_PATH}` } : undefined,
    footer: {
      reason: "You get this because you scheduled a post in iCapOS Social media. You can turn it off in your settings.",
      preferencesUrl: `${SITE_URL}/founder/settings/email`,
      lines: [NOT_A_BROKER_DEALER],
    },
  });
}

type ProfileRow = { id: string; email: string | null; full_name: string | null; role: string | null };

export type PostLiveInput = {
  /** social_posts.owner_profile_id: the founder who owns the post. */
  founderId: string;
  /** The published variant, so each account gets exactly one alert. */
  variantId: string;
  postId: string;
  platform: string | null;
  title: string;
  url: string | null;
  publishedAt?: Date;
};

export type PostLiveResult = { notified: boolean; emailed: boolean };

export async function notifyFounderPostLive(input: PostLiveInput): Promise<PostLiveResult> {
  const result: PostLiveResult = { notified: false, emailed: false };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    const { data } = await db.from("profiles").select("id, email, full_name, role").eq("id", input.founderId).maybeSingle();
    const founder = data as ProfileRow | null;
    if (!founder || founder.role !== "founder") return result;

    const copy = postLiveCopy({ platform: input.platform, title: input.title });
    const note = await createNotification({
      recipientUserId: founder.id,
      type: POST_LIVE_NOTIFICATION_TYPE,
      title: copy.title,
      message: copy.message,
      entityType: "social_post",
      entityId: input.postId,
      deepLink: liveLink(input.url) ?? POSTS_PATH,
      dedupeKey: `social_post_live:${input.variantId}`,
    });
    result.notified = Boolean(note);

    if (!founder.email || isInternalAccount(founder)) return result;
    if (!(await shouldSendEmail(founder.id, POST_LIVE_NOTIFICATION_TYPE))) return result;

    const mail = postLiveEmail({
      firstName: founder.full_name?.split(" ")[0] ?? null,
      platform: input.platform,
      title: input.title,
      url: input.url,
      publishedAt: input.publishedAt ?? new Date(),
    });
    await sendEmail({ to: founder.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
    result.emailed = true;
  } catch {
    /* best effort: a notice must never break publishing */
  }
  return result;
}
