import { NextResponse, type NextRequest } from "next/server";
import { recordMatchClick } from "@/lib/match-campaigns/public";

export const dynamic = "force-dynamic";

// GET /mc/[token]?a=call|intro — tracked link from a Match campaign email. Public: the
// signed token attributes the click, then the founder is sent to the scheduling page
// (call) or plan picker (intro). Never errors at the founder: a bad token goes home.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const action = req.nextUrl.searchParams.get("a") ?? "page";
  let target = "/";
  try {
    target = await recordMatchClick(token, action);
  } catch {
    target = "/";
  }
  return NextResponse.redirect(new URL(target, req.nextUrl.origin), 302);
}
