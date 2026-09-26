import "server-only";

/**
 * Sends a "Reach out to founder" email, with iCapOS or the staff member's Gmail.
 * Shared by the Send button (POST /api/admin/companies/[id]/reach-out) and the
 * scheduled sends job, so a scheduled email goes out exactly like one sent by hand.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendViaGmail } from "@/lib/integrations/gmail-send";
import { sendTransactionalEmail } from "@/lib/email/transactional-send";
import { createNotification } from "@/lib/notifications/notifications";

export type ReachOutVia = "icapos" | "gmail";

export type ReachOutMessage = {
  companyId: string;
  founderId: string;
  /** The staff member sending: Gmail account, reply-to and activity log actor. */
  actorId: string;
  actorEmail: string | null;
  to: string;
  subject: string;
  body: string;
  /** Body as HTML, signature already appended when asked for. */
  html: string;
  via: ReachOutVia;
  alsoNudge: boolean;
};

export type DeliveryResult = { ok: true; channel?: string } | { ok: false; error: string };

export function gmailError(e: Error): string {
  return /token|scope|connect|auth/i.test(e.message)
    ? "Your Gmail isn't connected. Connect Google in Integrations, then try again."
    : "Gmail request failed. Try again.";
}

export async function logOutreach(
  admin: SupabaseClient,
  companyId: string,
  actorId: string,
  kind: "draft" | "sent",
  via: ReachOutVia = "gmail",
  extra: Record<string, unknown> = {},
) {
  try {
    await admin.from("operational_activity_events").insert({
      event_type: kind === "sent" ? "founder_outreach_sent" : "founder_outreach_drafted",
      actor_user_id: actorId,
      entity_id: companyId,
      metadata: { company_id: companyId, via, ...extra },
    });
  } catch {
    /* best-effort */
  }
}

export async function deliverReachOut(
  admin: SupabaseClient,
  m: ReachOutMessage,
  logExtra: Record<string, unknown> = {},
): Promise<DeliveryResult> {
  if (m.via === "icapos") {
    try {
      // Replies go to the staff member, so a platform-addressed email still
      // reaches a person. Degrades to an in-app notification without Resend.
      const sent = await sendTransactionalEmail({
        to: m.to,
        subject: m.subject,
        body: m.body,
        html: m.html,
        replyTo: m.actorEmail ?? null,
        founderId: m.founderId,
        notificationType: "founder_outreach",
        entityType: "company",
        entityId: m.companyId,
      });
      await logOutreach(admin, m.companyId, m.actorId, "sent", "icapos", logExtra);
      return { ok: true, channel: sent.channel };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "iCapOS could not send that email." };
    }
  }

  const r = await sendViaGmail({ userId: m.actorId, to: m.to, subject: m.subject, body: m.body, html: m.html });
  if ("error" in r) return { ok: false, error: gmailError(r.error) };

  if (m.alsoNudge) {
    await createNotification({
      recipientUserId: m.founderId,
      type: "founder_outreach_nudge",
      title: "A note from the iCapOS team",
      message: m.subject,
      entityType: "company",
      entityId: m.companyId,
    }).catch(() => {});
  }
  await logOutreach(admin, m.companyId, m.actorId, "sent", "gmail", logExtra);
  return { ok: true };
}
