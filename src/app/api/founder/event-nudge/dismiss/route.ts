import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { eventId }: the founder closed the nudge for this event. Saved with the
 * founder's own session, so row level security limits it to their own row.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { eventId?: unknown } | null;
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  if (!UUID.test(eventId)) return NextResponse.json({ error: "A valid eventId is required." }, { status: 400 });

  const { error } = await (auth.supabase as unknown as SupabaseClient)
    .from("event_nudge_dismissals")
    .upsert(
      { user_id: auth.profile.id, event_id: eventId, dismissed_at: new Date().toISOString() },
      { onConflict: "user_id,event_id" },
    );
  if (error) return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
