import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getBusinessPlan, upsertBusinessPlan } from "@/lib/business-plan/store";
import { renderBusinessPlanPdf } from "@/lib/business-plan/pdf";
import { getStorageBucket, buildStoragePath, createDocumentRecord } from "@/lib/data/documents";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";
const DOC_TYPE = "BUSINESS_PLAN";

/** Render the plan to PDF, save it as a BUSINESS_PLAN document, mark finalized. */
export async function POST(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const plan = await getBusinessPlan(g.supabase, g.company.id);
    if (!plan) return NextResponse.json({ error: "Nothing to finalize yet." }, { status: 400 });

    const company = {
      name: g.company.company_name,
      industry: g.company.industry ?? null,
      stage: g.company.revenue_stage ?? null,
      fundingAmount: g.company.funding_amount ?? null,
    };
    const buffer = await renderBusinessPlanPdf(plan, company);

    const admin = createServiceRoleClient();
    const fileName = `${g.company.company_name} — Business plan.pdf`.replace(/[^a-zA-Z0-9._ -]/g, "");
    const bucket = getStorageBucket(DOC_TYPE);
    const filePath = buildStoragePath(DOC_TYPE, g.company.id, g.profile.id, fileName);

    const up = await admin.storage.from(bucket).upload(filePath, buffer, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error(up.error.message);

    // Archive any prior active business plan so only the latest counts.
    await admin.from("documents").update({ status: "archived" }).eq("company_id", g.company.id).eq("document_type", DOC_TYPE).neq("status", "archived");

    const { data: docRow, error: docErr } = await createDocumentRecord(admin, {
      company_id: g.company.id,
      uploaded_by: g.profile.id,
      document_type: DOC_TYPE,
      file_name: fileName,
      mime_type: "application/pdf",
      size_bytes: buffer.length,
      status: "uploaded",
      file_path: filePath,
      file_url: null,
      ai_summary: plan.execSummary ?? null,
    });
    if (docErr) throw new Error(docErr.message);

    await upsertBusinessPlan(g.supabase, g.company.id, g.profile.id, { status: "finalized" });
    await writeAuditLog(g.supabase, {
      userId: g.profile.id,
      action: "business_plan_finalized",
      entityType: "company",
      entityId: g.company.id,
      metadata: { documentId: docRow?.id ?? null },
    });

    return NextResponse.json({ ok: true, documentId: docRow?.id ?? null });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to finalize the plan." }, { status: 500 });
  }
}
