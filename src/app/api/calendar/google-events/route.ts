import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { listGoogleEvents } from "@/lib/integrations/google-calendar";

/**
 * GET /api/calendar/google-events?from=<iso>&to=<iso>
 * Read-only overlay of the signed-in user's Google Calendar events for the range.
 * Returns { events: [], connected: false } when Google isn't connected.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required." }, { status: 400 });
  }

  const token = await getValidGoogleAccessToken(auth.profile.id);
  if (!("accessToken" in token) || !token.accessToken) {
    return NextResponse.json({ events: [], connected: false });
  }

  try {
    const events = await listGoogleEvents(token.accessToken, from, to);
    return NextResponse.json({ events, connected: true });
  } catch (err) {
    return NextResponse.json(
      { events: [], connected: true, error: err instanceof Error ? err.message : "Failed to load Google events." },
      { status: 200 },
    );
  }
}
