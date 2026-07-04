import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { applyInvestorReview } from "@/lib/investor/profile";
import { recordComplianceEvent } from "@/lib/compliance/events";
import { notifyInvestorReview } from "@/lib/notifications/investor-events";
import { adminInvestorReviewActionSchema } from "@/lib/validation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendViaGmail } from "@/lib/integrations/gmail-send";
import { reviewMessageSubject } from "@/lib/investor/review-message";
import { resolveActionsForEntity } from "@/lib/next-best-actions/lifecycle";
import { buildActionId } from "@/lib/next-best-actions/action-catalog";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminInvestorReviewActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  }

  const { action, feedback, message, send } = parsed.data;

  if ((action === "reject" || action === "changes_requested") && !feedback?.trim()) {
    return NextResponse.json(
      { error: "Feedback is required when rejecting or requesting changes." },
      { status: 400 },
    );
  }

  const messageBody = message?.trim() || null;
  const shouldSend = Boolean(send && messageBody);

  try {
    const investorProfile = await applyInvestorReview({
      investorProfileId: id,
      adminId: auth.profile.id,
      action,
      feedback: feedback?.trim(),
    });

    // Clear the "Approve investor" to-do from every admin's dashboard now that
    // this investor is decided. Best-effort — never fail the decision on this.
    try {
      await resolveActionsForEntity(
        createServiceRoleClient(),
        buildActionId(["admin", "investor_approvals"]),
        [id, investorProfile.profile_id],
      );
    } catch (nbaError) {
      console.error("resolve investor approval action failed", nbaError);
    }

    // Audit logging must never fail the review action itself — the approval is
    // already committed above. Log best-effort and swallow logging errors.
    try {
      await writeAuditLog(auth.supabase, {
        userId: auth.profile.id,
        action: `investor.${action}`,
        entityType: "investor_profile",
        entityId: id,
        metadata: { feedback: feedback?.trim() ?? null, profile_id: investorProfile.profile_id },
      });
    } catch (auditError) {
      console.error("investor review audit log failed", auditError);
    }

    // In-app notification — use the drafted message verbatim when sending.
    void notifyInvestorReview({
      profileId: investorProfile.profile_id,
      action,
      adminId: auth.profile.id,
      entityId: id,
      feedback: feedback?.trim(),
      customMessage: shouldSend ? messageBody : null,
    });

    // Email the message via the reviewer's connected Gmail (best-effort).
    let emailSent = false;
    let emailError: string | null = null;
    if (shouldSend && messageBody) {
      const admin = createServiceRoleClient();
      const { data: recipient } = await admin
        .from("profiles")
        .select("email")
        .eq("id", investorProfile.profile_id)
        .single();
      const to = recipient?.email ?? null;
      if (!to) {
        emailError = "No email on file for this investor; sent in-app only.";
      } else {
        const result = await sendViaGmail({
          userId: auth.profile.id,
          to,
          subject: reviewMessageSubject(action),
          body: messageBody,
        });
        if ("error" in result) {
          emailError = result.error.message;
        } else {
          emailSent = true;
        }
      }
    }

    if (action === "reject") {
      void recordComplianceEvent({
        investorId: investorProfile.profile_id,
        eventType: "investor_review_rejection",
        severity: "medium",
        source: "investor_review",
        title: "Investor rejected",
        description: feedback?.trim() || "Investor application rejected by staff review.",
        sourceId: investorProfile.profile_id,
        metadata: { adminId: auth.profile.id },
      });
    }

    return NextResponse.json({ investorProfile, emailSent, emailError, notified: shouldSend });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update investor review.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
