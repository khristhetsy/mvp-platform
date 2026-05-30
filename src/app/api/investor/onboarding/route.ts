import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { ensureInvestorProfileForUser, isInvestorProfileComplete, parseCommaList } from "@/lib/investor/profile";
import { notifyStaff } from "@/lib/notifications/notifications";
import type { InvestorApprovalStatus } from "@/lib/investor/types";
import { investorOnboardingSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error;

  const investorProfile = await ensureInvestorProfileForUser(auth.profile.id);

  return NextResponse.json({ investorProfile });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = investorOnboardingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid investor onboarding payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await ensureInvestorProfileForUser(auth.profile.id);

  if (existing.approval_status === "submitted") {
    return NextResponse.json(
      { error: "Your profile is pending admin review. You cannot edit it until changes are requested." },
      { status: 400 },
    );
  }

  if (existing.approval_status === "approved" && parsed.data.submit) {
    return NextResponse.json({ error: "Your investor profile is already approved." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const draftUpdate = {
    investor_type: parsed.data.investor_type,
    firm_name: parsed.data.firm_name?.trim() || null,
    check_size_min: parsed.data.check_size_min ?? null,
    check_size_max: parsed.data.check_size_max ?? null,
    preferred_sectors: parseCommaList(parsed.data.preferred_sectors),
    preferred_geographies: parseCommaList(parsed.data.preferred_geographies),
    preferred_stages: parseCommaList(parsed.data.preferred_stages),
    accredited_status: parsed.data.accredited_status,
    investment_thesis: parsed.data.investment_thesis.trim(),
    contact_preference: parsed.data.contact_preference,
    updated_at: now,
  };

  const shouldSubmit = Boolean(parsed.data.submit);
  const merged = { ...existing, ...draftUpdate };

  if (shouldSubmit && !isInvestorProfileComplete(merged)) {
    return NextResponse.json({ error: "Complete all required onboarding fields before submitting." }, { status: 400 });
  }

  let approval_status: InvestorApprovalStatus = existing.approval_status;
  if (shouldSubmit) {
    approval_status = "submitted";
  } else if (existing.approval_status === "draft" || existing.approval_status === "rejected") {
    approval_status = "draft";
  }

  const { data, error } = await auth.supabase
    .from("investor_profiles")
    .update({
      ...draftUpdate,
      approval_status: shouldSubmit ? "submitted" : approval_status,
      submitted_at: shouldSubmit ? now : existing.submitted_at,
      admin_feedback: shouldSubmit ? null : existing.admin_feedback,
      updated_at: now,
    })
    .eq("profile_id", auth.profile.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to save investor onboarding." }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: shouldSubmit ? "investor.onboarding_submitted" : "investor.onboarding_saved",
    entityType: "investor_profile",
    entityId: data.id,
    metadata: { approval_status: data.approval_status },
  });

  if (shouldSubmit) {
    void notifyStaff({
      actorUserId: auth.profile.id,
      type: "investor_onboarding_submitted",
      title: "Investor onboarding submitted",
      message: "A new investor profile was submitted and is awaiting admin approval.",
      entityType: "investor_profile",
      entityId: data.id,
    });
  }

  return NextResponse.json({ investorProfile: data });
}
