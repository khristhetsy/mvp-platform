import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getInvestorProfileByProfileId } from "@/lib/investor/profile";
import { loadInvestorStageView } from "@/lib/investor-journey/load";

export const dynamic = "force-dynamic";

/** The investor's current journey stage key, used by the sidebar to show locks. */
export async function GET() {
  try {
    const profile = await requireRole(["investor"]);
    const investor = await getInvestorProfileByProfileId(profile.id);
    if (!investor) return NextResponse.json({ stage: "onboard" });
    const view = await loadInvestorStageView(investor);
    return NextResponse.json({ stage: view.current.key });
  } catch {
    return NextResponse.json({ stage: "onboard" }, { status: 200 });
  }
}
