import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { summarizeDocumentById, listDocumentsNeedingSummary } from "@/lib/documents/summarize";
import { rescoreCompanyReadiness } from "@/lib/ai/rescore";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/admin/documents/backfill-summaries
// Generate ai_summary for documents that don't have one, then re-score the
// affected companies. Processes a capped batch per call — run repeatedly until
// `remaining` is 0. Staff only.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    companyId?: string;
    limit?: number;
    force?: boolean;
  };
  const limit = Math.min(Math.max(body.limit ?? 8, 1), 20);
  const admin = createServiceRoleClient();

  // Which documents to process this run.
  let targets: Array<{ id: string; company_id: string | null }>;
  if (body.force && body.companyId) {
    const { data } = await (admin as unknown as SupabaseClient)
      .from("documents")
      .select("id, company_id, file_path")
      .eq("company_id", body.companyId)
      .not("file_path", "is", null)
      .limit(limit);
    targets = ((data ?? []) as Array<{ id: string; company_id: string | null }>).map((d) => ({
      id: d.id,
      company_id: d.company_id,
    }));
  } else {
    targets = await listDocumentsNeedingSummary(admin, { companyId: body.companyId, limit });
  }

  let summarized = 0;
  const skipped: Record<string, number> = {};
  const affected = new Set<string>();

  for (const doc of targets) {
    const res = await summarizeDocumentById(admin, doc.id, { force: body.force });
    if (res.status === "ok") {
      summarized += 1;
      if (doc.company_id) affected.add(doc.company_id);
    } else {
      skipped[res.reason ?? "unknown"] = (skipped[res.reason ?? "unknown"] ?? 0) + 1;
    }
  }

  // Re-score every company that got a new summary.
  const rescored: Array<{ companyId: string; totalScore?: number; ok: boolean }> = [];
  for (const companyId of affected) {
    const r = await rescoreCompanyReadiness(admin, companyId);
    rescored.push({ companyId, totalScore: r.totalScore, ok: r.ok });
  }

  // How many still need a summary (so the caller knows whether to run again).
  const remaining = body.force ? 0 : (await listDocumentsNeedingSummary(admin, { companyId: body.companyId, limit: 500 })).length;

  return NextResponse.json({
    processed: targets.length,
    summarized,
    skipped,
    rescored,
    remaining,
  });
}
