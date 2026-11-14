import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { loadEventNudge } from "@/lib/icfo-events/event-nudge";

export const dynamic = "force-dynamic";

/**
 * GET: the next upcoming published event to nudge this founder toward, or null.
 * `?surface=home` (the card on Home) or `?surface=banner` (Raise, Present at
 * event). Null when the admin turned that surface off, when the founder is
 * registered or dismissed it, or when no event starts inside the nudge window.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const surface = req.nextUrl.searchParams.get("surface") === "banner" ? "banner" : "home";
  try {
    const nudge = await loadEventNudge({ profileId: auth.profile.id, email: auth.profile.email ?? null, surface });
    return NextResponse.json({ nudge });
  } catch {
    // A nudge is optional; a failed lookup shows nothing rather than an error.
    return NextResponse.json({ nudge: null });
  }
}
