import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { countMatches } from "@/lib/prospects/lists";

export const dynamic = "force-dynamic";

// GET /api/prospects/list-count?side=&segment=&status=&source=&minScore=&sector=&search=
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  try {
    const counts = await countMatches({
      side: sp.get("side") || undefined,
      segment: sp.get("segment") || undefined,
      status: sp.get("status") || undefined,
      leadStatus: sp.get("leadStatus") || undefined,
      source: sp.get("source") || undefined,
      minScore: sp.get("minScore") ? Number(sp.get("minScore")) : undefined,
      sector: sp.get("sector") || undefined,
      search: sp.get("search") || undefined,
    });
    return NextResponse.json(counts);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Count failed." }, { status: 500 });
  }
}
