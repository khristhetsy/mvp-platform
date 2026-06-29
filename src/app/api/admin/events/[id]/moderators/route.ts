import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listEventModerators, assignEventModerator } from "@/lib/icfo-events/moderators";

export const dynamic = "force-dynamic";

const assignSchema = z.object({
  userId: z.string().uuid(),
  rooms: z.array(z.string().max(40)).max(8).default([]),
});

/** List moderators for an event (staff). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const moderators = await listEventModerators(auth.supabase, id);
    return NextResponse.json({ moderators });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load moderators." }, { status: 500 });
  }
}

/** Assign (or update the rooms of) a moderator. Super-admin only. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("assign_roles");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = assignSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    await assignEventModerator(auth.supabase, id, parsed.data.userId, parsed.data.rooms, auth.profile.id);
    const moderators = await listEventModerators(auth.supabase, id);
    return NextResponse.json({ moderators });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to assign moderator." }, { status: 500 });
  }
}
