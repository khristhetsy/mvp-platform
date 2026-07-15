import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getMarketingSettings, updateMarketingSettings } from "@/lib/marketing/settings";

export const dynamic = "force-dynamic";

// GET — marketing default sender settings.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json(await getMarketingSettings());
}

const putSchema = z.object({
  default_from_name: z.string().max(120).optional(),
  default_from_email: z.string().email().max(200).optional(),
  default_reply_to: z.string().email().max(200).nullable().optional(),
  senders: z.array(z.object({ name: z.string().max(120), email: z.string().email().max(200) })).max(25).optional(),
});

// PUT — update the default sender used when creating new campaigns/sequences.
export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A valid From email (and optional reply-to) is required." }, { status: 400 });
  try {
    await updateMarketingSettings(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
