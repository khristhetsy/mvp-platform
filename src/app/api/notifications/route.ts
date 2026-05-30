import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  countUnreadNotifications,
  listUserNotifications,
  markAllNotificationsRead,
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

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark notifications read.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
