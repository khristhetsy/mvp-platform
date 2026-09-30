import { NextResponse } from "next/server";
import { verifyFounderToken } from "@/lib/marketing/match-campaign/token";
import { recordFounderClick } from "@/lib/marketing/match-campaign/store";

export const dynamic = "force-dynamic";

// GET /mc/[token]?a=call|intro — public. Records the founder's click on the
// Match campaign email or match page, then redirects: "call" to the scheduling
// page, "intro" to /start to choose a plan. A bad token still lands somewhere
// useful rather than an error page.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("a") === "call" ? "call" : "intro";
  const id = verifyFounderToken(token);
  let target: string | null = null;
  if (id) {
    try {
      target = await recordFounderClick(id, action);
    } catch {
      target = null;
    }
  }
  const fallback = action === "call" ? "/fit" : "/start?src=match_campaign";
  return NextResponse.redirect(new URL(target ?? fallback, url.origin), 302);
}
