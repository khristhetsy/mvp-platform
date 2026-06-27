import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateFinancialModelApi } from "@/lib/financial-model/gate";
import { resolveAssumptions } from "@/lib/financial-model/resolve";
import { computeProjections } from "@/lib/business-plan/projections";
import { computeMonthlyModel } from "@/lib/financial-model/monthly";
import { renderFinancialModelWorkbook } from "@/lib/financial-model/workbook";
import { getStorageBucket, buildStoragePath, createDocumentRecord } from "@/lib/data/documents";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import type { ProjectionAssumptions } from "@/lib/business-plan/projections";

export const dynamic = "force-dynamic";

// Counts toward "Financial model" readiness AND unblocks the Qualify gate, which
// both resolve FINANCIAL_STATEMENTS (see DOC_TYPE_ALIASES in founder-readiness).
const DOC_TYPE = "FINANCIAL_STATEMENTS";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Build the .xlsx model from the founder's drivers and save it as a document. */
export async function POST(req: Request): Promise<Response> {
  const g = await gateFinancialModelApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      assumptions?: Partial<ProjectionAssumptions>;
      source?: "business-plan" | "fresh";
    };

    const assumptions = resolveAssumptions(
      body.assumptions ?? null,
      g.company.revenue_stage ?? null,
      g.company.funding_amount ?? null,
    );
    const projections = computeProjections(assumptions);
    const monthly = computeMonthlyModel(assumptions);

    const buffer = await renderFinancialModelWorkbook({
      companyName: g.company.company_name,
      assumptions,
      projections,
      monthly,
      source: body.source === "business-plan" ? "business-plan" : "fresh",
    });

    const admin = createServiceRoleClient();
    const fileName = `${g.company.company_name} — Financial model.xlsx`.replace(/[^a-zA-Z0-9._ -]/g, "");
    const bucket = getStorageBucket(DOC_TYPE);
    const filePath = buildStoragePath(DOC_TYPE, g.company.id, g.profile.id, fileName);

    const up = await admin.storage.from(bucket).upload(filePath, buffer, { contentType: XLSX_MIME, upsert: false });
    if (up.error) throw new Error(up.error.message);

    // Archive any prior active financial model so only the latest counts.
    await admin
      .from("documents")
      .update({ status: "archived" })
      .eq("company_id", g.company.id)
      .eq("document_type", DOC_TYPE)
      .eq("status", "uploaded");

    const { data: docRow, error: docErr } = await createDocumentRecord(admin, {
      company_id: g.company.id,
      uploaded_by: g.profile.id,
      document_type: DOC_TYPE,
      file_name: fileName,
      mime_type: XLSX_MIME,
      size_bytes: buffer.length,
      status: "uploaded",
      file_path: filePath,
      file_url: null,
      ai_summary: null,
    });
    if (docErr) throw new Error(docErr.message);

    const { data: signed } = await admin.storage.from(bucket).createSignedUrl(filePath, 60 * 10);

    await writeAuditLog(g.supabase, {
      userId: g.profile.id,
      action: "financial_model_generated",
      entityType: "company",
      entityId: g.company.id,
      metadata: { documentId: docRow?.id ?? null, source: body.source ?? "fresh" },
    });

    return NextResponse.json({
      ok: true,
      documentId: docRow?.id ?? null,
      fileName,
      url: signed?.signedUrl ?? null,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to generate the financial model." }, { status: 500 });
  }
}
