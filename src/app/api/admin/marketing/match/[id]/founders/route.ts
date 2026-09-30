import { NextResponse, type NextRequest } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { listCampaignFounders, listFounderMatches } from "@/lib/match-campaigns/service";

export const dynamic = "force-dynamic";

// GET /api/admin/marketing/match/[id]/founders?view=all|ready|matched|excluded
//   or ?founder=<campaign founder id> for one founder's matches (admin view, names shown).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  try {
    const founder = sp.get("founder");
    if (founder) return NextResponse.json({ matches: await listFounderMatches(founder) });
    const view = (sp.get("view") ?? "all") as "all" | "ready" | "matched" | "excluded";
    const result = await listCampaignFounders(id, {
      view,
      q: sp.get("q") ?? "",
      page: Math.max(0, Number(sp.get("page") ?? 0) || 0),
      pageSize: Math.min(200, Math.max(10, Number(sp.get("size") ?? 50) || 50)),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load founders." }, { status: 500 });
  }
}
