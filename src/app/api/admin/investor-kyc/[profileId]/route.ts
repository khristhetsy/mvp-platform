import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { track } from "@/lib/analytics/posthog";
import { applyInvestorKycReview } from "@/lib/investor/kyc";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ profileId: string }> };

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { profileId } = await params;
  const body = (await request.json().catch(() => null)) as
    | { action?: string; feedback?: string | null }
    | null;
  const action = body?.action;

  if (action !== "verify" && action !== "reject") {
    return NextResponse.json({ error: "Action must be 'verify' or 'reject'." }, { status: 400 });
  }
  if (action === "reject" && !body?.feedback?.trim()) {
    return NextResponse.json({ error: "Feedback is required when rejecting verification." }, { status: 400 });
  }

  try {
    const investorProfile = await applyInvestorKycReview({
      investorProfileId: profileId,
      adminId: auth.profile.id,
      action,
      feedback: body?.feedback ?? null,
    });

    await writeAuditLog(auth.supabase, {
      userId: auth.profile.id,
      action: `investor.kyc_${action}`,
      entityType: "investor_profile",
      entityId: profileId,
      metadata: { feedback: body?.feedback?.trim() ?? null, profile_id: investorProfile.profile_id },
    });

    if (action === "verify") {
      track("investor_kyc_verified", {
        userId: investorProfile.profile_id,
        investorProfileId: profileId,
      });
    }

    return NextResponse.json({ investorProfile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record KYC review.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
