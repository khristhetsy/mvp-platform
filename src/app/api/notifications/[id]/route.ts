import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notifications/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const notification = await markNotificationRead(id, user.id);
    if (!notification) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    return NextResponse.json({ notification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update notification.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
