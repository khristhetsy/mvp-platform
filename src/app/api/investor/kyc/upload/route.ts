import { NextResponse } from "next/server";
import { requireInvestorApi } from "@/lib/api/investor";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { writeAuditLog } from "@/lib/data/audit";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { KYC_BUCKET, buildKycStoragePath, isKycDocType, saveKycDocument } from "@/lib/investor/kyc";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request): Promise<Response> {
  const auth = await requireInvestorApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // KYC is Stage 2 — available only after the profile (Stage 1) is approved,
  // but BEFORE kyc is verified, so we gate on approval, not the full gate.
  if (auth.investorProfile?.approval_status !== "approved") {
    return NextResponse.json(
      { error: "Your profile must be approved before identity verification.", code: "profile_not_approved" },
      { status: 403 },
    );
  }
  const investorProfileId = auth.investorProfile.id;

  const rateLimited = await enforceRateLimit({
    bucket: "investor_kyc_upload",
    subjectId: auth.profile.id,
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const docType = String(formData?.get("docType") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (!isKycDocType(docType, auth.investorProfile.investor_type)) {
    return NextResponse.json({ error: "Unknown document type for your investor type." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be between 1 byte and 15 MB." }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Upload a PDF, JPG, PNG, or WEBP file." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const filePath = buildKycStoragePath(investorProfileId, docType, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const up = await admin.storage.from(KYC_BUCKET).upload(filePath, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (up.error) {
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 400 });
  }

  try {
    const document = await saveKycDocument({
      investorProfileId,
      docType,
      fileName: file.name,
      filePath,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    await writeAuditLog(admin, {
      userId: auth.profile.id,
      action: "investor.kyc_document_uploaded",
      entityType: "investor_profile",
      entityId: investorProfileId,
      metadata: { docType, documentId: document.id },
    });

    return NextResponse.json({ document });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save document.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
