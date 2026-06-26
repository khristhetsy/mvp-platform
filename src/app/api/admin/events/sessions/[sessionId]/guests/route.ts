import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/api/permissions";
import { mapSessionGuest } from "@/lib/icfo-events/live-session";

export const dynamic = "force-dynamic";

const schema = z.object({
  eventId: z.string().uuid(),
  displayName: z.string().min(1).max(120),
  roleLabel: z.string().max(120).nullable().optional(),
});

/** Add a guest to a talk-show session roster (staff). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const db = auth.supabase as unknown as SupabaseClient;
    const { data, error } = await db
      .from("session_guests")
      .insert({
        session_id: sessionId,
        event_id: parsed.data.eventId,
        display_name: parsed.data.displayName,
        role_label: parsed.data.roleLabel ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ guest: mapSessionGuest(data as Record<string, unknown>) }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to add guest." }, { status: 500 });
  }
}
