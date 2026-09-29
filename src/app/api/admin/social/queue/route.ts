/** GET /api/admin/social/queue — the current queue (for refresh after actions). */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listQueue } from "@/lib/social/queries";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return NextResponse.json({ queue: await listQueue() });
}
