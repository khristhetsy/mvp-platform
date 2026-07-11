import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadMeetingMeta } from "@/lib/meetings/tasks";

export const dynamic = "force-dynamic";

// GET — departments + assignable staff for the New Task modal.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json(await loadMeetingMeta());
}
