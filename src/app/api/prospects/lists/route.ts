import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSavedLists } from "@/lib/prospects/saved-lists";

export const dynamic = "force-dynamic";

// GET /api/prospects/lists?archived=1 — saved contact lists directory.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
  try {
    return NextResponse.json(await getSavedLists(includeArchived));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
