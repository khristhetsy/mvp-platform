import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listFilings, type SavedView, type FilingFilters } from "@/lib/formd/store";

export const dynamic = "force-dynamic";

const VIEWS: SavedView[] = ["eligible", "stall_window", "aging_in", "agent_watch", "all"];

/** Scored filings for a saved view + ad-hoc filters (staff read). */
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const num = (k: string) => (sp.get(k) != null ? Number(sp.get(k)) : undefined);
  const boolp = (k: string) => (sp.get(k) == null ? undefined : sp.get(k) === "true");
  const viewParam = sp.get("view") as SavedView | null;
  const filters: FilingFilters = {
    view: viewParam && VIEWS.includes(viewParam) ? viewParam : "eligible",
    minRemaining: num("minRemaining"),
    minScore: num("minScore"),
    isFund: boolp("isFund"),
    hasAgent: boolp("hasAgent"),
    is506c: boolp("is506c"),
    daysMin: num("daysMin"),
    daysMax: num("daysMax"),
    pipeline: (sp.get("pipeline") as FilingFilters["pipeline"]) ?? undefined,
    limit: num("limit"),
    offset: num("offset"),
  };
  try {
    const { rows, count } = await listFilings(filters);
    return NextResponse.json({ rows, count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load filings." }, { status: 500 });
  }
}
