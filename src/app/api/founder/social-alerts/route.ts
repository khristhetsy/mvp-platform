import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadNotificationPrefs } from "@/lib/notifications/preferences";

export const dynamic = "force-dynamic";

const KEY = "social_post_published";

/** GET: the founder's two switches for "your post is live" (both on until they change them). */
export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const prefs = await loadNotificationPrefs(auth.profile.id);
  const ev = prefs.events[KEY] ?? { in_app: true, email: true, digest: false };
  return NextResponse.json({ inApp: ev.in_app, email: ev.email });
}

/**
 * PUT: save the two switches. Only this event changes; every other notification
 * choice the founder has is written back exactly as it was.
 */
export async function PUT(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { inApp?: unknown; email?: unknown } | null;
  if (!body || typeof body.inApp !== "boolean" || typeof body.email !== "boolean") {
    return NextResponse.json({ error: "Send both switches." }, { status: 400 });
  }

  const prefs = await loadNotificationPrefs(auth.profile.id);
  const events = { ...prefs.events, [KEY]: { in_app: body.inApp, email: body.email, digest: false } };

  // notification_preferences isn't in the generated Supabase types yet.
  const db = createServiceRoleClient() as unknown as SupabaseClient;
  const { error } = await db
    .from("notification_preferences")
    .upsert({ user_id: auth.profile.id, ...prefs, events, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true, inApp: body.inApp, email: body.email });
}
