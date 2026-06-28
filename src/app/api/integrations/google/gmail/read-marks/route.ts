import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { markThreadRead } from "@/lib/integrations/gmail-read-marks";

export const dynamic = "force-dynamic";

const schema = z.object({ threadId: z.string().min(1).max(200) });

/** POST — record a Gmail thread as read inside iCapOS (read-only workaround). */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "threadId is required." }, { status: 400 });
  try {
    await markThreadRead(auth.supabase, auth.profile.id, parsed.data.threadId);
    return NextResponse.json({ ok: true });
  } catch {
    // Non-critical — never block the inbox over a read mark.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
