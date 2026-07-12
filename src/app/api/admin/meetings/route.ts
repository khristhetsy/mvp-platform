import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listRecentSessions, ensureSession } from "@/lib/meetings/foundation";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ sessions: await listRecentSessions() });
}

const createSchema = z.object({
  meetingKey: z.string().min(1).max(60).default("mgmt"),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

// POST — create (or return) a meeting session for a date.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A valid meeting date is required." }, { status: 400 });
  try {
    const sessionId = await ensureSession(parsed.data.meetingKey, parsed.data.sessionDate, profile.id, parsed.data.sessionTime ?? null);
    return NextResponse.json({ sessionId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create session." }, { status: 500 });
  }
}
