import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { applyAccreditationReview } from "@/lib/investor/kyc";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ profileId: string }> };

/** Admin verifies / unverifies the investor's optional accreditation evidence. */
export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { profileId } = await params;
  const body = (await request.json().catch(() => null)) as { verified?: boolean } | null;
  if (typeof body?.verified !== "boolean") {
    return NextResponse.json({ error: "verified must be a boolean." }, { status: 400 });
  }

  try {
    const investorProfile = await applyAccreditationReview(profileId, auth.profile.id, body.verified);
    await writeAuditLog(auth.supabase, {
      userId: auth.profile.id,
      action: body.verified ? "investor.accreditation_verified" : "investor.accreditation_unverified",
      entityType: "investor_profile",
      entityId: profileId,
      metadata: { profile_id: investorProfile.profile_id },
    });
    return NextResponse.json({ investorProfile });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to update accreditation." }, { status: 400 });
  }
}
