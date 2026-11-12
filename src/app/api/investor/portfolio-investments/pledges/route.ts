import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listPledges } from "@/lib/portfolio/db";

/** GET /api/investor/portfolio-investments/pledges
 *  Returns investor_interests with pledge_amount set — used for the Committed tab.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error as NextResponse;

  try {
    if (!isFeatureEnabled(await loadFeatureFlags(createServiceRoleClient()), "investor", "pledged")) {
      return NextResponse.json([]);
    }
    const pledges = await listPledges(auth.profile.id);
    return NextResponse.json(pledges);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
