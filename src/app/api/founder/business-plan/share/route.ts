import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getStorageBucket } from "@/lib/data/documents";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const FOURTEEN_DAYS = 14 * 24 * 60 * 60;

/** Private, view-only, 14-day signed link to the finalized business-plan PDF. */
export async function POST(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const admin = createServiceRoleClient();
    const { data: doc } = await admin
      .from("documents")
      .select("file_path")
      .eq("company_id", g.company.id)
      .eq("document_type", "BUSINESS_PLAN")
      .eq("status", "uploaded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const filePath = (doc as { file_path?: string | null } | null)?.file_path;
    if (!filePath) {
      return NextResponse.json({ error: "Finalize your plan first to create a shareable PDF." }, { status: 400 });
    }

    const { data, error } = await admin.storage
      .from(getStorageBucket("BUSINESS_PLAN"))
      .createSignedUrl(filePath, FOURTEEN_DAYS);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not create link.");

    return NextResponse.json({ url: data.signedUrl, expiresInDays: 14 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create share link." }, { status: 500 });
  }
}
