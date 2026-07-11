import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { setAttendance, type AttendStatus } from "@/lib/meetings/foundation";

export const dynamic = "force-dynamic";

const schema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["expected", "present", "absent", "remote", "off"]),
});

// POST — set a person's attendance for a session.
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid attendance payload." }, { status: 400 });
  try {
    await setAttendance(sessionId, parsed.data.userId, parsed.data.status as AttendStatus);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to set attendance." }, { status: 500 });
  }
}
