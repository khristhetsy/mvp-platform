import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadMeetings, setMeetingEvent } from "@/lib/ceo/meetings";
import { createRecurringMeeting } from "@/lib/ceo/calendar";

export const dynamic = "force-dynamic";

// POST /api/ceo/meetings/[key]/calendar — create the recurring Meet event on the
// calling admin's connected Google account and store the event id.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const { key } = await params;
    const { meetings } = await loadMeetings();
    const meeting = meetings.find((m) => m.key === key);
    if (!meeting) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    const result = await createRecurringMeeting(meeting, profile.id);
    await setMeetingEvent(key, result.eventId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Calendar sync failed." }, { status: 400 });
  }
}
