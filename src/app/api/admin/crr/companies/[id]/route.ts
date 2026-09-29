/** One company's score timeline — every appended score row, newest first. Admin/analyst. */
import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { companyScoreTimeline } from "@/lib/crr/weight-sets-db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const db = createServiceRoleClient();
  try {
    const [rows, company] = await Promise.all([
      companyScoreTimeline(db, id),
      db.from("companies").select("company_name").eq("id", id).maybeSingle(),
    ]);
    return NextResponse.json({
      company: (company.data as { company_name?: string } | null)?.company_name ?? "Company",
      events: rows.map((r) => ({
        id: r.id as string,
        at: r.created_at as string,
        score: (r.score_seriesa_institutional ?? r.total_score) as number,
        override: r.override_score as number | null,
        overrideReason: r.override_reason as string | null,
        kind: (r.change_kind as string) ?? "scored",
        reason: (r.change_reason as string) ?? null,
        version: (r.score_version as string) ?? null,
        documents: (r.document_count as number) ?? 0,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the timeline." }, { status: 500 });
  }
}
