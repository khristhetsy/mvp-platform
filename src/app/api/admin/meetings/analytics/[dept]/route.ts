import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getMeetingAnalytics } from "@/lib/meetings/analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET — zero-copy Hub analytics for a department's 📡 sub-tab.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ dept: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { dept } = await params;
  return NextResponse.json({ analytics: await getMeetingAnalytics(dept) });
}
