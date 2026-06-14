import { NextRequest, NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { updateTask } from "@/lib/tasks/db";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import {
  createAllDayCalendarEvent,
  cancelCalendarEvent,
} from "@/lib/integrations/google-calendar";
import { createServiceRoleClient } from "@/lib/supabase/admin";

async function getTask(id: string, userId: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("tasks")
    .select("*")
    .eq("id", id)
    .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/** POST /api/tasks/[id]/calendar — sync task to Google Calendar as an all-day event */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const profile = await requireUserProfile();
    const { id } = await params;

    const task = await getTask(id, profile.id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (!task.due_date) {
      return NextResponse.json({ error: "Task has no due date" }, { status: 400 });
    }

    const tokenResult = await getValidGoogleAccessToken(profile.id);
    if (tokenResult.error || !tokenResult.accessToken) {
      return NextResponse.json(
        { error: "Google Calendar not connected. Connect your Google account in Settings." },
        { status: 400 },
      );
    }

    const { eventId } = await createAllDayCalendarEvent(
      {
        title: task.title,
        date: task.due_date.slice(0, 10),
        notes: task.description ?? null,
      },
      tokenResult.accessToken,
    );

    const updated = await updateTask(id, { google_calendar_event_id: eventId });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** DELETE /api/tasks/[id]/calendar — remove task from Google Calendar */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const profile = await requireUserProfile();
    const { id } = await params;

    const task = await getTask(id, profile.id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.google_calendar_event_id) {
      const tokenResult = await getValidGoogleAccessToken(profile.id);
      if (tokenResult.accessToken) {
        // Best-effort — don't fail if event was already deleted from Google side
        await cancelCalendarEvent(task.google_calendar_event_id, tokenResult.accessToken).catch(() => null);
      }
    }

    const updated = await updateTask(id, { google_calendar_event_id: null });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
