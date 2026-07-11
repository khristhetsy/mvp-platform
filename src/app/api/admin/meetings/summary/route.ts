import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getMeetingOpsSummary } from "@/lib/meetings/summary";

export const dynamic = "force-dynamic";

// GET — meeting-system operating snapshot for the CEO Hub cockpit.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ summary: await getMeetingOpsSummary() });
}
