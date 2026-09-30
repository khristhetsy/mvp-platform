/**
 * GET /api/sales/contacts/duplicates?q=&offset= — contacts that share one email address, grouped,
 * largest groups first (25 per page). Feeds the Contacts "Duplicates" view. Staff only.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listDuplicateGroups } from "@/lib/sales/merge-contacts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0) || 0);
  try {
    return NextResponse.json(await listDuplicateGroups(q, offset));
  } catch {
    return NextResponse.json({ error: "Couldn't load duplicates." }, { status: 500 });
  }
}
