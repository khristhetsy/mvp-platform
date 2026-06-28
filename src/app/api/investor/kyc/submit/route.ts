import { NextResponse } from "next/server";
import { requireInvestorApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { track } from "@/lib/analytics/posthog";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeKycChecklistState, listKycDocuments, submitInvestorKyc } from "@/lib/investor/kyc";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireInvestorApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.investorProfile?.approval_status !== "approved") {
    return NextResponse.json(
      { error: "Your profile must be approved before identity verification.", code: "profile_not_approved" },
      { status: 403 },
    );
  }
  const profile = auth.investorProfile;

  if (profile.kyc_status === "verified") {
    return NextResponse.json({ error: "Your account is already verified." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { legalName?: string; consent?: boolean } | null;
  const legalName = body?.legalName?.trim() ?? "";
  const consent = body?.consent === true;
  if (legalName.length < 2) {
    return NextResponse.json({ error: "Enter your legal name as it appears on your ID.", code: "legal_name_required" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "Please consent to storing your ID for verification.", code: "consent_required" }, { status: 400 });
  }

  const documents = await listKycDocuments(profile.id);
  const state = computeKycChecklistState(profile.investor_type, documents);
  if (!state.canSubmit) {
    return NextResponse.json(
      {
        error: "Upload your form of identification before submitting for verification.",
        code: "kyc_incomplete",
        missing: state.missingRequired.map((m) => ({ code: m.code, label: m.label })),
      },
      { status: 403 },
    );
  }

  try {
    const updated = await submitInvestorKyc(profile.id, { legalName, consent });
    const admin = createServiceRoleClient();
    await writeAuditLog(admin, {
      userId: auth.profile.id,
      action: "investor.kyc_submitted",
      entityType: "investor_profile",
      entityId: profile.id,
      metadata: { documentCount: documents.filter((d) => d.status === "uploaded").length },
    });
    track("investor_kyc_submitted", { userId: auth.profile.id, investorProfileId: profile.id });
    return NextResponse.json({ investorProfile: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit for verification.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
