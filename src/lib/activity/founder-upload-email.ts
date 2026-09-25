/**
 * The founder's side of a document upload: a confirmation that names the file,
 * shows where they are in Rate, Ready, Match, Raise, and points at the next core
 * document. Founders stall between Ready and Match; this email is the nudge at
 * the moment they are already acting.
 *
 * Staff details (stage owner, readiness score) never appear here.
 * Best effort: never throws, never blocks the upload.
 */
import "server-only";
import { loadNotificationPrefs } from "@/lib/notifications/preferences";
import { sendTransactionalEmail } from "@/lib/email/transactional-send";
import { loadActorEmailContext, loadCompanyEmailContext } from "@/lib/activity/email-context";
import { absoluteUrl, renderFounderUploadEmail } from "@/lib/activity/email-templates";

export async function sendFounderUploadConfirmation(input: {
  userId: string;
  companyId: string;
  documentId: string;
  documentLabel: string;
  fileName: string | null;
  replaced: boolean;
}): Promise<void> {
  try {
    const prefs = await loadNotificationPrefs(input.userId);
    if (prefs.pause_all || !prefs.channel_email) return;

    const company = await loadCompanyEmailContext(input.companyId);
    const actor = await loadActorEmailContext(input.userId, company.founderId);
    if (!actor?.email) return;

    const email = renderFounderUploadEmail({
      firstName: actor.firstName,
      companyName: company.companyName,
      documentLabel: input.documentLabel,
      fileName: input.fileName,
      replaced: input.replaced,
      stepIndex: company.stepIndex,
      checklist: company.checklist,
      next: company.next
        ? { label: company.next.label, cta: company.next.cta, url: absoluteUrl(company.next.href) }
        : null,
      workspaceUrl: absoluteUrl("/founder"),
    });

    await sendTransactionalEmail({
      to: actor.email,
      subject: email.subject,
      body: email.text,
      html: email.html,
      founderId: input.userId,
      notificationType: "founder_document_received",
      deepLink: "/founder/documents",
      entityType: "document",
      entityId: input.documentId,
      dedupeKey: `founder-upload:${input.documentId}`,
    });
  } catch (error) {
    console.error("[capitalos] founder upload confirmation failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
