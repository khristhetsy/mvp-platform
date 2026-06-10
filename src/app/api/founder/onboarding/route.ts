import { NextResponse } from "next/server";
import { listCompanyDocuments } from "@/lib/data/documents";
import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { buildCompanyOnboardingSyncUpdate } from "@/lib/onboarding/sync-progress";
import { createNotification } from "@/lib/notifications/notifications";
import { syncFounderRemediationTasks } from "@/lib/remediation/tasks";
import { ONBOARDING_STEP_IDS, type OnboardingStepId } from "@/lib/onboarding/progress";
import { requireApiProfile } from "@/lib/api/auth";
import { founderOnboardingStepSchema } from "@/lib/validation";
import type { Company } from "@/lib/supabase/types";

async function requireCompanyManager(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerSupabaseClient>>, userId: string, companyId: string) {
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.role === "owner" || membership?.role === "admin") {
    return true;
  }

  const { data: legacy } = await supabase.from("companies").select("id").eq("id", companyId).eq("founder_id", userId).maybeSingle();
  return Boolean(legacy);
}

function companyPatchFromStep(parsed: ReturnType<typeof founderOnboardingStepSchema.parse>): Partial<Company> {
  const patch: Partial<Company> = {};

  if (parsed.company_name != null) patch.company_name = parsed.company_name;
  if (parsed.website != null) patch.website = parsed.website || null;
  if (parsed.industry != null) patch.industry = parsed.industry;
  if (parsed.country != null) patch.country = parsed.country;
  if (parsed.state != null) patch.state = parsed.state || null;
  if (parsed.business_description != null) patch.business_description = parsed.business_description;
  if (parsed.founder_goals != null) patch.founder_goals = parsed.founder_goals;
  if (parsed.funding_amount != null) patch.funding_amount = parsed.funding_amount;
  if (parsed.revenue_stage != null) patch.revenue_stage = parsed.revenue_stage;
  if (parsed.use_of_funds != null) patch.use_of_funds = parsed.use_of_funds;

  if (parsed.step === "investor_readiness_review") {
    patch.review_status = "pending";
    patch.status = "pending";
  }

  return patch;
}

export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { data: company, error } = await auth.supabase
    .from("companies")
    .select("*")
    .eq("founder_id", auth.profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const [{ data: documents }, { data: diligenceReport }] = await Promise.all([
    listCompanyDocuments(auth.supabase, company.id),
    getLatestDiligenceReport(auth.supabase, company.id),
  ]);
  const sync = buildCompanyOnboardingSyncUpdate({
    company: company as typeof company & { onboarding_step_state?: unknown },
    documents: documents ?? [],
    diligenceReportExists: Boolean(diligenceReport),
  });

  return NextResponse.json({
    company,
    progress: sync.progress,
    documents: documents ?? [],
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = founderOnboardingStepSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: company, error: companyError } = await auth.supabase
    .from("companies")
    .select("*")
    .eq("founder_id", auth.profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (companyError || !company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const canManage = await requireCompanyManager(auth.supabase, auth.profile.id, company.id);
  if (!canManage) {
    return NextResponse.json({ error: "You do not have permission to update this company." }, { status: 403 });
  }

  const patch = companyPatchFromStep(parsed.data);
  const advanceStep = parsed.data.advanceToStep ?? parsed.data.step;

  let updatedCompany = company;

  if (Object.keys(patch).length > 0) {
    const { data, error } = await auth.supabase
      .from("companies")
      .update(patch)
      .eq("id", company.id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Unable to save onboarding step." }, { status: 400 });
    }

    updatedCompany = data;
  }

  const [{ data: documents }, { data: diligenceReport }] = await Promise.all([
    listCompanyDocuments(auth.supabase, company.id),
    getLatestDiligenceReport(auth.supabase, company.id),
  ]);

  const sync = buildCompanyOnboardingSyncUpdate({
    company: updatedCompany as typeof updatedCompany & { onboarding_step_state?: unknown },
    documents: documents ?? [],
    diligenceReportExists: Boolean(diligenceReport),
    currentStep: ONBOARDING_STEP_IDS.includes(advanceStep as OnboardingStepId)
      ? (advanceStep as OnboardingStepId)
      : undefined,
  });

  const wasOnboardingComplete = Boolean(company.onboarding_completed_at);

  const { data: finalCompany, error: syncError } = await auth.supabase
    .from("companies")
    .update({
      onboarding_progress_percent: sync.onboarding_progress_percent,
      onboarding_step_state: sync.onboarding_step_state,
      onboarding_completed_at: sync.onboarding_completed_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", company.id)
    .select("*")
    .single();

  if (syncError || !finalCompany) {
    return NextResponse.json({ error: syncError?.message ?? "Unable to sync onboarding progress." }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "founder.onboarding_step_saved",
    entityType: "company",
    entityId: company.id,
    metadata: {
      step: parsed.data.step,
      progress_percent: sync.onboarding_progress_percent,
    },
  });

  if (!wasOnboardingComplete && finalCompany.onboarding_completed_at) {
    void createNotification({
      recipientUserId: auth.profile.id,
      type: "founder_onboarding_completed",
      title: "Founder onboarding completed",
      message: "Your onboarding is complete. Continue strengthening readiness and submit for admin review.",
      entityType: "company",
      entityId: company.id,
    });

    emitOperationalEvent(createServiceRoleClient(), {
      eventType: "founder_onboarding_completed",
      eventCategory: "onboarding",
      entityType: "company",
      entityId: company.id,
      actorUserId: auth.profile.id,
      actorRole: auth.profile.role,
      companyId: company.id,
      relatedUserId: auth.profile.id,
      title: "Founder onboarding completed",
      sourceModule: "founder_onboarding",
      visibility: "company_related",
      dedupeKey: `founder_onboarding_completed:${company.id}`,
      metadata: {
        progress_percent: sync.onboarding_progress_percent,
      },
    });
  }

  try {
    await syncFounderRemediationTasks({
      company: finalCompany as Company,
      founderId: auth.profile.id,
      documents: documents ?? [],
      diligenceReport: diligenceReport ?? null,
      onboardingPercent: sync.onboarding_progress_percent,
    });
  } catch {
    // Remediation sync is best-effort; onboarding save must still succeed.
  }

  return NextResponse.json({
    company: finalCompany,
    progress: sync.progress,
  });
}
