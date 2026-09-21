/**
 * Turning an activity event into a notification for the right people.
 *
 * Routing is: the stage's assignees, plus the class's override targets
 * (Compliance, CEO), falling back to every super_admin when nobody holds the
 * stage. On top of that sit the preferences that already exist — quiet hours,
 * pause-all, the critical override — which are honoured unchanged rather than
 * reimplemented here.
 *
 * Digest handling is the one rule worth stating plainly: a class marked
 * `digestable: false` is never held for a digest, whatever the preference says.
 * A deletion or a gate crossing twelve hours late is not a notification, it is
 * an archive entry.
 */
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { isQuietNow, loadNotificationPrefs } from "@/lib/notifications/preferences";
import { sendTransactionalEmail } from "@/lib/email/transactional-send";
import {
  type ActivityClassKey,
  type ActivityStage,
  activityClass,
  activityStageLabel,
} from "@/lib/activity/stages";
import { resolveRecipients } from "@/lib/activity/assignments";
import { type ActivityChannelPrefs, activityPrefsFrom } from "@/lib/activity/preferences";

export type DispatchInput = {
  eventId: string;
  classKey: ActivityClassKey;
  stage: ActivityStage;
  severity: string;
  title: string;
  companyId: string | null;
  investorId: string | null;
  actorUserId: string | null;
};

function deepLinkFor(input: DispatchInput): string {
  if (input.companyId) return `/admin/companies/${input.companyId}?tab=activity`;
  return `/admin/activity?event=${input.eventId}`;
}

/**
 * Whether this recipient gets this class on this channel.
 *
 * Per-class preferences live on top of the platform's existing per-event ones;
 * a class with no stored preference falls back to the class's own defaults, so
 * a new class is live the moment it ships rather than silently off.
 */
function allowed(
  prefs: ActivityChannelPrefs,
  classKey: ActivityClassKey,
  channel: "in_app" | "email" | "digest",
): boolean {
  const cls = activityClass(classKey);
  if (!cls) return false;
  if (channel === "digest" && !cls.digestable) return false;
  const stored = prefs.classes[classKey];
  return (stored ?? cls.defaults)[channel];
}

export async function dispatchActivityNotifications(input: DispatchInput): Promise<void> {
  const cls = activityClass(input.classKey);
  if (!cls) return;

  const { leadUserId, userIds, usedFallback } = await resolveRecipients(input.stage, cls);
  if (!userIds.length) return;

  const critical = input.severity === "critical";
  const stageLabel = activityStageLabel(input.stage);
  const link = deepLinkFor(input);

  // The lead is named so the alert has an owner. Without this, three people on a
  // stage is three people each assuming one of the others has it.
  const leadName = leadUserId ? await displayName(leadUserId) : null;
  const message = usedFallback
    ? `${stageLabel} · nobody is assigned to this stage`
    : leadName
      ? `${stageLabel} · ${leadName} leads`
      : `${stageLabel} · no lead assigned`;

  await Promise.all(
    userIds.map(async (userId) => {
      // One read, two views of it — the activity classes live in the same
      // `events` jsonb as the platform's existing event keys.
      const prefs = await loadNotificationPrefs(userId);
      const activityPrefs = activityPrefsFrom(prefs);

      // pause-all still wins, except for critical when the override is on —
      // the same rule the rest of the platform already applies.
      if (prefs.pause_all && !(critical && prefs.critical_override)) return;

      if (prefs.channel_in_app && allowed(activityPrefs, input.classKey, "in_app")) {
        await createNotification({
          recipientUserId: userId,
          actorUserId: input.actorUserId,
          type: `activity_${input.classKey}`,
          title: input.title,
          message,
          entityType: "operational_activity_event",
          entityId: input.eventId,
          severity: input.severity,
          deepLink: link,
          dedupeKey: `activity:${input.eventId}:${userId}`,
        });
      }

      if (!prefs.channel_email || !allowed(activityPrefs, input.classKey, "email")) return;
      if (isQuietNow(prefs) && !(critical && prefs.critical_override)) return;

      const email = await emailOf(userId);
      if (!email) return;

      await sendTransactionalEmail({
        to: email,
        subject: critical ? `[Action needed] ${input.title}` : input.title,
        body: [
          input.title,
          "",
          message,
          cls.description,
          "",
          `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${link}`,
        ].join("\n"),
        // Without RESEND_API_KEY this falls back to an in-app notification for
        // the addressee, so the recipient id is the staff member, not a founder.
        founderId: userId,
        notificationType: `activity_${input.classKey}`,
        deepLink: link,
        entityType: "operational_activity_event",
        entityId: input.eventId,
        dedupeKey: `activity-email:${input.eventId}:${userId}`,
      });
    }),
  );
}

async function displayName(userId: string): Promise<string | null> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    const name = typeof row?.full_name === "string" ? row.full_name.trim() : "";
    if (name) return name;
    return typeof row?.email === "string" ? row.email : null;
  } catch {
    return null;
  }
}

async function emailOf(userId: string): Promise<string | null> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
    const email = (data as Record<string, unknown> | null)?.email;
    return typeof email === "string" && email.includes("@") ? email : null;
  } catch {
    return null;
  }
}
