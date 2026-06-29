import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/api/permissions";
import { mapSegment } from "@/lib/icfo-events/segments";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["pending", "live", "done"]).optional(),
});

/** Edit a segment's title or status (staff). Marking one "live" sends any other
 *  live segment in the same session to "done" — only one is ever on air. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; segmentId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId, segmentId } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    const db = auth.supabase as unknown as SupabaseClient;

    if (parsed.data.status === "live") {
      await db
        .from("session_segments")
        .update({ status: "done" })
        .eq("session_id", sessionId)
        .eq("status", "live")
        .neq("id", segmentId);
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;

    const { data, error } = await db
      .from("session_segments")
      .update(patch)
      .eq("id", segmentId)
      .eq("session_id", sessionId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ segment: mapSegment(data as Record<string, unknown>) });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update segment." }, { status: 500 });
  }
}

/** Remove a segment from the run-of-show (staff). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; segmentId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId, segmentId } = await params;
    const db = auth.supabase as unknown as SupabaseClient;
    const { error } = await db.from("session_segments").delete().eq("id", segmentId).eq("session_id", sessionId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to delete segment." }, { status: 500 });
  }
}
