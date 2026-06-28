import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { setPriorDealVerified } from "@/lib/investor/prior-deals";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Admin verifies / unverifies a single prior deal. */
export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { verified?: boolean } | null;
  if (typeof body?.verified !== "boolean") {
    return NextResponse.json({ error: "verified must be a boolean." }, { status: 400 });
  }

  try {
    const deal = await setPriorDealVerified(id, body.verified, auth.profile.id);
    await writeAuditLog(auth.supabase, {
      userId: auth.profile.id,
      action: body.verified ? "investor.deal_verified" : "investor.deal_unverified",
      entityType: "investor_prior_deal",
      entityId: id,
      metadata: { company: deal.company_name },
    });
    return NextResponse.json({ deal });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to update deal." }, { status: 400 });
  }
}
