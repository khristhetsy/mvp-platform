import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { logModerationAction } from "@/lib/icfo-events/moderators";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(400),
  room: z.string().max(40).optional(),
});

/** Record a venue broadcast for audit. Delivery happens over the Realtime
 *  channel from the sender's client; this persists the action + content. */
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
      action: "broadcast",
      target: parsed.data.room ?? "Everyone",
      metadata: { title: parsed.data.title, body: parsed.data.body },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to record broadcast." }, { status: 500 });
  }
}
