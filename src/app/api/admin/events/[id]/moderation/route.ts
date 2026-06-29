import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { logModerationAction } from "@/lib/icfo-events/moderators";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["move_attendee", "remove_attendee"]),
  targetId: z.string().min(1).max(80),
  targetName: z.string().max(120).optional(),
  room: z.string().max(40).optional(),
});

/** Record a moderation action (move / remove an attendee) for audit. The
 *  realtime signal to the attendee is sent from the sender's client. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    await logModerationAction(auth.supabase, {
      eventId: id,
      actorId: auth.profile.id,
      action: parsed.data.action,
      target: parsed.data.targetName ?? parsed.data.targetId,
      metadata: { room: parsed.data.room ?? null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to record action." }, { status: 500 });
  }
}
