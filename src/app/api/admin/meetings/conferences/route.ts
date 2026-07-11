import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listConferences, createConference } from "@/lib/meetings/conferences";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(2).max(200),
  kind: z.enum(["conference", "summit", "talkshow", "webinar"]).optional(),
  description: z.string().max(4000).nullable().optional(),
  start_date: z.string().min(4),
  end_date: z.string().nullable().optional(),
  timezone: z.string().max(64).optional(),
  location: z.string().max(300).nullable().optional(),
  event_url: z.string().max(500).nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  host_id: z.string().uuid().nullable().optional(),
});

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ conferences: await listConferences() });
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid conference." }, { status: 400 });
  try {
    const id = await createConference(parsed.data, profile.id);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create conference." }, { status: 500 });
  }
}
