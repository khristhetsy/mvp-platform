import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { decideQueueItem } from "@/lib/sales-ai/queue-store";

export const dynamic = "force-dynamic";

const schema = z.object({ itemId: z.string().uuid(), action: z.enum(["skip", "snooze"]) });

// POST: a person skips or snoozes one of today's queue items. That is the only write the queue allows.
export async function POST(req: Request): Promise<Response> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await decideQueueItem(parsed.data.itemId, parsed.data.action, auth.profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update the queue." }, { status: 500 });
  }
}
