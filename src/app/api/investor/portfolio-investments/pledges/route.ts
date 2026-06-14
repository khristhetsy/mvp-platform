import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { listPledges } from "@/lib/portfolio/db";

/** GET /api/investor/portfolio-investments/pledges
 *  Returns investor_interests with pledge_amount set — used for the Committed tab.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error as NextResponse;

  try {
    const pledges = await listPledges(auth.profile.id);
    return NextResponse.json(pledges);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
