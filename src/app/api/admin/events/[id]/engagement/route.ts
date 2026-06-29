import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { setMute, setBan, awardBonusPoints } from "@/lib/icfo-events/engagement";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mute"), profileId: z.string().uuid(), mute: z.boolean() }),
  z.object({ kind: z.literal("ban"), profileId: z.string().uuid(), ban: z.boolean(), permanent: z.boolean().default(false) }),
  z.object({ kind: z.literal("award"), profileIds: z.array(z.string()).max(500), points: z.number().int().min(1).max(500) }),
]);

/** Mute/unmute, ban/unban, or drop bonus points. Staff (manage_events). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const body = parsed.data;

    if (body.kind === "mute") {
      await setMute(auth.supabase, id, body.profileId, body.mute, auth.profile.id);
      return NextResponse.json({ ok: true });
    }
    if (body.kind === "ban") {
      await setBan(auth.supabase, id, body.profileId, body.ban, body.permanent, auth.profile.id);
      return NextResponse.json({ ok: true });
    }
    const awarded = await awardBonusPoints(auth.supabase, id, body.profileIds, body.points, auth.profile.id);
    return NextResponse.json({ ok: true, awarded });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
