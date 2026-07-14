import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getContacts } from "@/lib/marketing/contacts";

// GET /api/marketing/contacts/grid — paginated {contacts,total} for the contacts grid.
//   params: search, list_id, tag, source, sort (name|company|created_at), dir, offset, limit
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const p = req.nextUrl.searchParams;
    const sortRaw = p.get("sort") ?? "created_at";
    const sort = (["name", "company", "created_at"].includes(sortRaw) ? sortRaw : "created_at") as "name" | "company" | "created_at";
    const result = await getContacts({
      search: p.get("search") ?? undefined,
      list_id: p.get("list_id") ?? undefined,
      tag: p.get("tag") ?? undefined,
      source: p.get("source") ?? undefined,
      sort,
      dir: p.get("dir") === "asc" ? "asc" : "desc",
      offset: Math.max(0, Number(p.get("offset") ?? 0) || 0),
      limit: Math.min(200, Math.max(1, Number(p.get("limit") ?? 50) || 50)),
      enrich: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
