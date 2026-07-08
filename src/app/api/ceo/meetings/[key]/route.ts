import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateMeeting } from "@/lib/ceo/meetings";
import { updateRecurringMeeting } from "@/lib/ceo/calendar";

export const dynamic = "force-dynamic";

const schema = z.object({
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  timeLocal: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
  timezone: z.string().max(60).optional(),
  attendees: z.array(z.object({ name: z.string().max(120).optional(), email: z.string().email().optional() })).max(50).optional(),
});

// PATCH /api/ceo/meetings/[key] — edit the meeting schedule; re-sync the recurring event if linked.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const { key } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const meeting = await updateMeeting(key, parsed.data);
    // Best-effort: keep the connected calendar event in sync (never fails the request).
    if (meeting.gcalEventId) await updateRecurringMeeting(meeting, profile.id).catch(() => {});
    return NextResponse.json({ ok: true, meeting });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
