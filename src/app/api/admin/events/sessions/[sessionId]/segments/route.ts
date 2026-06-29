import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/api/permissions";
import { mapSegment } from "@/lib/icfo-events/segments";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().min(1).max(120),
});

/** List a session's run-of-show segments (staff). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const db = auth.supabase as unknown as SupabaseClient;
    const { data, error } = await db
      .from("session_segments")
      .select("*")
      .eq("session_id", sessionId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ segments: ((data ?? []) as Record<string, unknown>[]).map(mapSegment) });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load segments." }, { status: 500 });
  }
}

/** Append a segment to the run-of-show (staff). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    const db = auth.supabase as unknown as SupabaseClient;

    // Next position = max(existing) + 1.
    const { data: last } = await db
      .from("session_segments")
      .select("position")
      .eq("session_id", sessionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (last ? Number((last as { position?: number }).position ?? 0) : 0) + 1;

    const { data, error } = await db
      .from("session_segments")
      .insert({ session_id: sessionId, event_id: parsed.data.eventId, title: parsed.data.title, position: nextPos })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ segment: mapSegment(data as Record<string, unknown>) }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to add segment." }, { status: 500 });
  }
}
