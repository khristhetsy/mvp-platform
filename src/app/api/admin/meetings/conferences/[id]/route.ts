import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getConference, updateConference } from "@/lib/meetings/conferences";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(2).max(200).optional(),
  kind: z.enum(["conference", "summit", "talkshow", "webinar"]).optional(),
  description: z.string().max(4000).nullable().optional(),
  start_date: z.string().min(4).optional(),
  end_date: z.string().nullable().optional(),
  timezone: z.string().max(64).optional(),
  location: z.string().max(300).nullable().optional(),
  event_url: z.string().max(500).nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  host_id: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "scheduled", "live", "done", "cancelled"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  return NextResponse.json(await getConference(id));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    await updateConference(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update conference." }, { status: 500 });
  }
}
