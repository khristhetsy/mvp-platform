import { NextResponse } from "next/server";
import { requireInvestorApi } from "@/lib/api/investor";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { KYC_BUCKET, buildKycStoragePath } from "@/lib/investor/kyc";
import { attachDealProof } from "@/lib/investor/prior-deals";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

type RouteContext = { params: Promise<{ id: string }> };

/** Upload proof for a single prior deal — stored privately, resets verification. */
export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const auth = await requireInvestorApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.investorProfile?.approval_status !== "approved" || !auth.investorProfile) {
    return NextResponse.json({ error: "Your profile must be approved first." }, { status: 403 });
  }
  const investorProfileId = auth.investorProfile.id;
  const { id: dealId } = await params;

  const rateLimited = await enforceRateLimit({
    bucket: "investor_deal_proof_upload",
    subjectId: auth.profile.id,
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be between 1 byte and 15 MB." }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Upload a PDF, JPG, PNG, or WEBP file." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const filePath = buildKycStoragePath(investorProfileId, `deal_proof/${dealId}`, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const up = await admin.storage.from(KYC_BUCKET).upload(filePath, buffer, { contentType: file.type, upsert: false });
  if (up.error) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 400 });

  const { data: doc, error: docErr } = await admin
    .from("investor_kyc_documents")
    .insert({
      investor_profile_id: investorProfileId,
      doc_type: "deal_proof",
      file_name: file.name,
      file_path: filePath,
      mime_type: file.type,
      size_bytes: file.size,
      status: "uploaded",
    })
    .select("id")
    .single();
  if (docErr || !doc) {
    return NextResponse.json({ error: docErr?.message ?? "Failed to save proof." }, { status: 400 });
  }

  try {
    await attachDealProof(investorProfileId, dealId, doc.id as string);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to attach proof." }, { status: 400 });
  }
}
