// Live per-step completion for the stage guides. Each step maps to a real
// signal (profile fields, uploaded documents, business-plan sections, a readiness
// score, a diligence report, outreach/CRM/deal activity, milestones). Equal-weight
// roll-up over the measured steps.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";
import { buildProfileCompletion, buildDocumentChecklist, getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { listCompanyDocuments } from "@/lib/data/documents";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { BUSINESS_PLAN_SECTIONS } from "@/lib/business-plan/sections";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFounderMilestones } from "@/lib/data/founder-milestones";

export type StepState = "done" | "in_progress" | "not_started" | "unknown";
export interface StepProgress {
  percent: number | null;
  state: StepState;
}
export interface StageProgress {
  /** keyed by step href */
  steps: Record<string, StepProgress>;
  /** equal-weight average over measured steps, or null if none are measurable */
  overall: number | null;
}

const EMPTY: StageProgress = { steps: {}, overall: null };

function step(percent: number | null): StepProgress {
  if (percent === null || Number.isNaN(percent)) return { percent: null, state: "unknown" };
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return { percent: p, state: p >= 100 ? "done" : p > 0 ? "in_progress" : "not_started" };
}

function rollup(steps: Record<string, StepProgress>): StageProgress {
  const measured = Object.values(steps)
    .map((s) => s.percent)
    .filter((p): p is number => p != null);
  const overall = measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : null;
  return { steps, overall };
}

async function hasRow(
  admin: SupabaseClient,
  table: string,
  filters: Record<string, string>,
): Promise<boolean> {
  let q = admin.from(table).select("id", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count } = await q;
  return (count ?? 0) > 0;
}

export async function computeStageProgress(
  supabase: SupabaseClient<Database>,
  company: Company | null,
  slug: string,
  profileId: string,
): Promise<StageProgress> {
  if (!company) return EMPTY;

  if (slug === "onboarding" || slug === "preparation") {
    const [docsRes, plan, reportRes] = await Promise.all([
      listCompanyDocuments(supabase, company.id).catch(() => ({ data: [] })),
      getBusinessPlan(supabase, company.id).catch(() => null),
      getLatestDiligenceReport(supabase, company.id).catch(() => ({ data: null })),
    ]);

    const documents = docsRes.data ?? [];
    const checklist = buildDocumentChecklist(documents);
    const applicable = checklist.filter((c) => c.status !== "not_applicable");
    const uploadedCount = applicable.filter((c) => c.status === "uploaded" || c.status === "needs_review").length;
    const docsPercent = applicable.length ? (uploadedCount / applicable.length) * 100 : 0;
    const hasDoc = (label: string) =>
      checklist.some((c) => c.label === label && (c.status === "uploaded" || c.status === "needs_review"));

    const profilePercent = buildProfileCompletion(company).percent;

    const coreIds = BUSINESS_PLAN_SECTIONS.filter((s) => s.core).map((s) => s.id);
    const planPercent = plan
      ? (coreIds.filter((id) => ((plan.sections?.[id]?.content ?? "") as string).trim().length > 0).length /
          Math.max(coreIds.length, 1)) *
        100
      : 0;

    const hasReport = Boolean((reportRes as { data?: unknown } | null)?.data);

    const { data: scoreRow } = await (supabase as unknown as SupabaseClient)
      .from("company_readiness_scores")
      .select("total_score")
      .eq("company_id", company.id)
      .maybeSingle();
    const hasScore = (scoreRow as { total_score?: number | null } | null)?.total_score != null;

    if (slug === "onboarding") {
      return rollup({
        "/founder/settings": step(profilePercent),
        "/founder/preview": step(profilePercent),
      });
    }
    return rollup({
      "/founder/readiness/wizard": step(hasScore ? 100 : 0),
      "/founder/business-plan": step(planPercent),
      "/founder/pitch-deck": step(hasDoc("Pitch deck") ? 100 : 0),
      "/founder/readiness/data-room": step(docsPercent),
      "/founder/report": step(hasReport ? 100 : 0),
    });
  }

  if (slug === "marketing") {
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    const [hasOutreach, hasIntro, hasInterest, hasSaved, hasApplication] = await Promise.all([
      hasRow(admin, "outreach_campaigns", { company_id: company.id }),
      hasRow(admin, "intro_requests", { company_id: company.id }),
      hasRow(admin, "investor_interests", { company_id: company.id }),
      hasRow(admin, "saved_deals", { company_id: company.id }),
      hasRow(admin, "speaker_applications", { applicant_id: profileId }),
    ]);
    const inPipeline = hasIntro || hasInterest || hasSaved;
    return rollup({
      "/founder/deploy": step(hasOutreach ? 100 : 0),
      "/founder/investor-pipeline": step(inPipeline ? 100 : 0),
      "/founder/events/present": step(hasApplication ? 100 : 0),
    });
  }

  if (slug === "closing") {
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    const [hasDealRoom, hasSpv, hasUpdate, milestoneCats] = await Promise.all([
      hasRow(admin, "deal_rooms", { company_id: company.id }),
      hasRow(admin, "spv_participations", { company_id: company.id }),
      hasRow(admin, "company_updates", { company_id: company.id }),
      loadFounderMilestones(supabase, createServiceRoleClient(), company, profileId).catch(() => []),
    ]);

    const allMilestones = milestoneCats.flatMap((c) => c.milestones);
    const achieved = allMilestones.filter((m) => m.status === "achieved").length;
    const milestonePercent = allMilestones.length ? (achieved / allMilestones.length) * 100 : null;

    const offeringSet = Boolean((company as { offering_type?: string | null }).offering_type);

    return rollup({
      "/founder/deal-room": step(hasDealRoom ? 100 : 0),
      "/founder/offering-type": step(offeringSet ? 100 : 0),
      "/founder/spvs": step(hasSpv ? 100 : 0),
      "/founder/investor-update": step(hasUpdate ? 100 : 0),
      "/founder/milestones": step(milestonePercent),
    });
  }

  return EMPTY;
}
