// Live per-step completion for the stage guides. Each step maps to a real
// signal (profile fields, uploaded documents, business-plan sections, a readiness
// score, a diligence report). Equal-weight roll-up over the measured steps.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";
import { buildProfileCompletion, buildDocumentChecklist, getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { listCompanyDocuments } from "@/lib/data/documents";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { BUSINESS_PLAN_SECTIONS } from "@/lib/business-plan/sections";

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

function step(percent: number | null): StepProgress {
  if (percent === null || Number.isNaN(percent)) return { percent: null, state: "unknown" };
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return { percent: p, state: p >= 100 ? "done" : p > 0 ? "in_progress" : "not_started" };
}

export async function computeStageProgress(
  supabase: SupabaseClient<Database>,
  company: Company | null,
  slug: string,
): Promise<StageProgress> {
  const empty: StageProgress = { steps: {}, overall: null };
  if (!company) return empty;

  // Marketing / closing steps have no cheap completion signal yet — no bars shown.
  if (slug !== "onboarding" && slug !== "preparation") return empty;

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

  const byStage: Record<string, Record<string, StepProgress>> = {
    onboarding: {
      "/founder/settings": step(profilePercent),
      // The one-pager is generated from the profile, so it tracks profile completeness.
      "/founder/preview": step(profilePercent),
    },
    preparation: {
      "/founder/readiness/wizard": step(hasScore ? 100 : 0),
      "/founder/business-plan": step(planPercent),
      "/founder/pitch-deck": step(hasDoc("Pitch deck") ? 100 : 0),
      "/founder/readiness/data-room": step(docsPercent),
      "/founder/report": step(hasReport ? 100 : 0),
    },
  };

  const steps = byStage[slug] ?? {};
  const measured = Object.values(steps)
    .map((s) => s.percent)
    .filter((p): p is number => p != null);
  const overall = measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : null;

  return { steps, overall };
}
