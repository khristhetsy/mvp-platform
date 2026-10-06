import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { loadPendingSuggestions } from "@/lib/verify/suggest";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/prospects/suggestions?ids=a,b,c — pending suggestions for these contacts.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => UUID.test(s)).slice(0, 500);
  if (ids.length === 0) return NextResponse.json({ suggestions: {} });
  try {
    return NextResponse.json({ suggestions: await loadPendingSuggestions(serviceRoleClientUntyped(), ids) });
  } catch (err) {
    // Before the v2 migration runs the table doesn't exist; the page still works without saved suggestions.
    return NextResponse.json({ suggestions: {}, error: err instanceof Error ? err.message : "Could not load suggestions." });
  }
}
