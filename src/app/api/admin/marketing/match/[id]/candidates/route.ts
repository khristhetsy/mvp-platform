import { NextResponse, type NextRequest } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { listFounderCandidates } from "@/lib/match-campaigns/service";
import { sourceTag, SOURCE_KEYS, type SourceKey } from "@/lib/match-campaigns/core";

export const dynamic = "force-dynamic";

function list(sp: URLSearchParams, key: string): string[] {
  return sp.getAll(key).flatMap((v) => v.split("|")).map((v) => v.trim()).filter(Boolean);
}

// GET /api/admin/marketing/match/[id]/candidates — step 2 founder list with filters.
export async function GET(req: NextRequest) {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;
  const sp = req.nextUrl.searchParams;
  try {
    const { rows, total } = await listFounderCandidates(
      {
        q: sp.get("q") ?? "",
        founderType: list(sp, "type"),
        industry: list(sp, "industry"),
        stage: list(sp, "stage"),
        source: list(sp, "source").filter((s): s is SourceKey => SOURCE_KEYS.includes(s as SourceKey)),
        listId: sp.get("list") || null,
      },
      Math.max(0, Number(sp.get("page") ?? 0) || 0),
      Math.min(200, Math.max(10, Number(sp.get("size") ?? 50) || 50)),
    );
    return NextResponse.json({
      total,
      rows: rows.map((r) => ({
        id: r.id,
        company: r.company,
        name: r.name,
        email: r.email,
        email_status: r.email_status,
        founder_type: r.founder_type,
        pipeline_stage: r.pipeline_stage,
        industry: (r.industries ?? [])[0] ?? null,
        stage: (r.funding_stages ?? [])[0] ?? null,
        industry_tag: sourceTag(r.industry_source),
        stage_tag: sourceTag(r.stage_source),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load founders." }, { status: 500 });
  }
}
