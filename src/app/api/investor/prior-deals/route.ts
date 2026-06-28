import { NextResponse } from "next/server";
import { requireInvestorApi } from "@/lib/api/investor";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { addPriorDeal } from "@/lib/investor/prior-deals";

export const dynamic = "force-dynamic";

function requireApproved(auth: { investorProfile?: { approval_status?: string | null } | null }) {
  return auth.investorProfile?.approval_status === "approved";
}

/** Add a prior deal. */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireInvestorApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireApproved(auth) || !auth.investorProfile) {
    return NextResponse.json({ error: "Your profile must be approved first." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { companyName?: string; stage?: string; year?: number; amount?: number }
    | null;
  const companyName = body?.companyName?.trim() ?? "";
  if (companyName.length < 2) {
    return NextResponse.json({ error: "Enter the company name." }, { status: 400 });
  }
  const year = typeof body?.year === "number" && body.year >= 1980 && body.year <= 2100 ? body.year : null;
  const amount = typeof body?.amount === "number" && body.amount >= 0 ? body.amount : null;

  try {
    const deal = await addPriorDeal({
      investorProfileId: auth.investorProfile.id,
      companyName,
      stage: body?.stage ?? null,
      year,
      amount,
    });
    return NextResponse.json({ deal });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to add deal." }, { status: 400 });
  }
}

/** Toggle whether the verified track record shows on the investor's profile. */
export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireInvestorApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.investorProfile) return NextResponse.json({ error: "No investor profile." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { showTrackRecord?: boolean } | null;
  if (typeof body?.showTrackRecord !== "boolean") {
    return NextResponse.json({ error: "showTrackRecord must be a boolean." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("investor_profiles")
    .update({ show_track_record: body.showTrackRecord, updated_at: new Date().toISOString() })
    .eq("id", auth.investorProfile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, showTrackRecord: body.showTrackRecord });
}
