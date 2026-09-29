/**
 * Tell the founder what happened to an introduction they requested: in app
 * always, by email when their preferences allow. Never throws: a notification
 * must not fail the staff action that caused it.
 */
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { loadNotificationPrefs } from "@/lib/notifications/preferences";
import { sendTransactionalEmail } from "@/lib/email/transactional-send";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { introOutcomeCopy, renderIntroOutcomeEmail, type IntroOutcome } from "@/lib/matching/intro-outcome-email";

export async function notifyFounderIntroOutcome(input: {
  founderId: string;
  companyName: string;
  outcome: IntroOutcome;
  investorLabel: string;
  note: string | null;
  actorUserId: string | null;
  entityType: "intro_request" | "prospect_intro_request";
  entityId: string;
}): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.from("profiles").select("full_name, email").eq("id", input.founderId).maybeSingle();
    const row = data as { full_name?: string | null; email?: string | null } | null;
    const fullName = (row?.full_name ?? "").trim();
    const copyInput = {
      outcome: input.outcome,
      firstName: fullName ? fullName.split(/\s+/)[0]! : null,
      companyName: input.companyName,
      investorLabel: input.investorLabel,
      note: input.note,
      matchesUrl: absoluteUrl("/founder/matches"),
    };
    const { title, message } = introOutcomeCopy(copyInput);

    await createNotification({
      recipientUserId: input.founderId,
      actorUserId: input.actorUserId,
      type: `founder_intro_${input.outcome}`,
      title,
      message,
      entityType: input.entityType,
      entityId: input.entityId,
      deepLink: "/founder/matches",
      dedupeKey: `founder_intro_${input.outcome}:${input.entityId}`,
    });

    const prefs = await loadNotificationPrefs(input.founderId);
    const email = row?.email ?? null;
    if (prefs.pause_all || !prefs.channel_email || !email || !email.includes("@")) return;
    const rendered = renderIntroOutcomeEmail(copyInput);
    await sendTransactionalEmail({
      to: email,
      subject: rendered.subject,
      body: rendered.text,
      html: rendered.html,
      founderId: input.founderId,
      notificationType: `founder_intro_${input.outcome}_email`,
      deepLink: "/founder/matches",
      entityType: input.entityType,
      entityId: input.entityId,
      dedupeKey: `founder_intro_${input.outcome}_email:${input.entityId}`,
    });
  } catch (error) {
    console.error("[capitalos] founder intro outcome notification failed", {
      entityId: input.entityId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
