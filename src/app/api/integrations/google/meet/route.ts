import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { listUpcomingMeetings } from "@/lib/integrations/google-meet";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET — upcoming Google Meet meetings from the user's connected calendar. */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { connected, meetings } = await listUpcomingMeetings(auth.profile.id);
    return NextResponse.json({ connected, meetings });
  } catch (err) {
    return NextResponse.json(
      { connected: true, meetings: [], error: err instanceof Error ? err.message : "Failed to load meetings." },
      { status: 200 },
    );
  }
}
