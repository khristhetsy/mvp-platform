/**
 * "I've seen these" — stops the escalation clock for the caller.
 *
 * Read state is per user, not per event, because "nobody opened it" has to mean
 * nobody ASSIGNED opened it. One staff member glancing at the feed must not
 * silence a stage they do not hold.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { markActivityEventsRead } from "@/lib/activity/escalation";

export const dynamic = "force-dynamic";

const schema = z.object({ eventIds: z.array(z.string().uuid()).min(1).max(500) });

export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing to mark." }, { status: 400 });
  }

  const result = await markActivityEventsRead(auth.profile.id, parsed.data.eventIds);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, marked: parsed.data.eventIds.length });
}
