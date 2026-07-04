import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getFounderProfiles } from "@/lib/prospects/founder-source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/prospects/founders?stage=&sector=&jurisdiction=&minReadiness=&minFunding=&search=
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  try {
    const result = await getFounderProfiles({
      stage: sp.get("stage") || undefined,
      sector: sp.get("sector") || undefined,
      jurisdiction: sp.get("jurisdiction") || undefined,
      minReadiness: sp.get("minReadiness") ? Number(sp.get("minReadiness")) : undefined,
      minFunding: sp.get("minFunding") ? Number(sp.get("minFunding")) : undefined,
      search: sp.get("search") || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
