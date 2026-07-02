import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { markRead } from "@/lib/marketing/notifications/store";

export const dynamic = "force-dynamic";

const schema = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() });

export async function POST(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    if (!parsed.data.id && !parsed.data.all) {
      return NextResponse.json({ error: "Provide an id or all=true." }, { status: 400 });
    }
    await markRead(profile.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
