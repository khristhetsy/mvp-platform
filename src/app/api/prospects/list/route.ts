import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getContactList } from "@/lib/prospects/store";

export const dynamic = "force-dynamic";

// GET /api/prospects/list?status=&side=&leadStatus=&search=&limit= — rows for a filtered slice.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") ?? 50) || 50, 200);
  const offset = Math.max(Number(sp.get("offset") ?? 0) || 0, 0);
  try {
    const idsParam = sp.get("ids");
    const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 1000) : undefined;
    const result = await getContactList({
      side: sp.get("side") || undefined,
      segment: sp.get("segment") || undefined,
      status: sp.get("status") || undefined,
      leadStatus: sp.get("leadStatus") || undefined,
      search: sp.get("search") || undefined,
      ids,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "List failed." }, { status: 500 });
  }
}
