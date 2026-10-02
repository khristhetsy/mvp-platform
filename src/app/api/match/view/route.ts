import { NextResponse } from "next/server";
import { verifyFounderToken } from "@/lib/marketing/match-campaign/token";
import { matchSequenceEnabled } from "@/lib/marketing/match-campaign/flag";
import { recordInvestorView } from "@/lib/marketing/match-campaign/followups";

export const dynamic = "force-dynamic";

// POST /api/match/view { token, match_id } — public. Counts one open of an
// investor profile on the founder's match page (signed token, no login). Used
// to name the most viewed investor in the follow up email. Never returns data.
export async function POST(request: Request) {
  if (!matchSequenceEnabled()) return new NextResponse(null, { status: 204 });
  const body = (await request.json().catch(() => null)) as { token?: unknown; match_id?: unknown } | null;
  const id = verifyFounderToken(typeof body?.token === "string" ? body.token : null);
  const matchId = typeof body?.match_id === "string" && /^[0-9a-f-]{36}$/i.test(body.match_id) ? body.match_id : null;
  if (!id || !matchId) return new NextResponse(null, { status: 204 });
  await recordInvestorView(id, matchId).catch(() => false);
  return new NextResponse(null, { status: 204 });
}
