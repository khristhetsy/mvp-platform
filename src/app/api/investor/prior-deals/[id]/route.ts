import { NextResponse } from "next/server";
import { requireInvestorApi } from "@/lib/api/investor";
import { deletePriorDeal } from "@/lib/investor/prior-deals";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  const auth = await requireInvestorApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.investorProfile) return NextResponse.json({ error: "No investor profile." }, { status: 403 });

  const { id } = await params;
  try {
    await deletePriorDeal(auth.investorProfile.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to delete deal." }, { status: 400 });
  }
}
