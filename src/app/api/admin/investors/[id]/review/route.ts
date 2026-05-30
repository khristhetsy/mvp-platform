import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { applyInvestorReview } from "@/lib/investor/profile";
import { notifyInvestorReview } from "@/lib/notifications/investor-events";
import { adminInvestorReviewActionSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminInvestorReviewActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  }

  const { action, feedback } = parsed.data;

  if ((action === "reject" || action === "changes_requested") && !feedback?.trim()) {
    return NextResponse.json(
      { error: "Feedback is required when rejecting or requesting changes." },
      { status: 400 },
    );
  }

  try {
    const investorProfile = await applyInvestorReview({
      investorProfileId: id,
      adminId: auth.profile.id,
      action,
      feedback: feedback?.trim(),
    });

    await writeAuditLog(auth.supabase, {
      userId: auth.profile.id,
      action: `investor.${action}`,
      entityType: "investor_profile",
      entityId: id,
      metadata: { feedback: feedback?.trim() ?? null, profile_id: investorProfile.profile_id },
    });

    void notifyInvestorReview({
      profileId: investorProfile.profile_id,
      action,
      adminId: auth.profile.id,
      entityId: id,
      feedback: feedback?.trim(),
    });

    return NextResponse.json({ investorProfile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update investor review.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
