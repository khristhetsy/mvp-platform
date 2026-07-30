import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  countUnreadNotifications,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  archiveNotifications,
  deleteNotifications,
} from "@/lib/notifications/notifications";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);

  try {
    const [notifications, unreadCount] = await Promise.all([
      listUserNotifications(user.id, limit),
      countUnreadNotifications(user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notifications.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST — bulk actions: { action: "read" | "archive" | "delete", ids: string[] }.
// With no body it marks all read (back-compat).
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { action?: string; ids?: string[] } | null;

  try {
    if (body?.action && Array.isArray(body.ids) && body.ids.length > 0) {
      const ids = body.ids.filter((v) => typeof v === "string").slice(0, 500);
      if (body.action === "read") await markNotificationsRead(ids, user.id);
      else if (body.action === "archive") await archiveNotifications(ids, user.id);
      else if (body.action === "delete") await deleteNotifications(ids, user.id);
      else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
      return NextResponse.json({ success: true });
    }
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update notifications.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
