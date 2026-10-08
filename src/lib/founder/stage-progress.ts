// Live per-step completion for the stage guides. Each step maps to a real
// signal (profile fields, uploaded documents, business-plan sections, a readiness
// score, a diligence report, outreach/CRM/deal activity, milestones). Equal-weight
// roll-up over the measured steps.
import type { SupabaseClient } from "@supabase/supabase-js";
import { crrScoresFor, OUTREACH_GATE } from "@/lib/crr/crr-for";
import type { Company, Database } from "@/lib/supabase/types";
import { buildProfileCompletion, buildDocumentChecklist, getLatestDiligenceReport, computeReadinessScore } from "@/lib/data/founder-readiness";
import { listCompanyDocuments } from "@/lib/data/documents";
import { loadNotApplicableTypes } from "@/lib/documents/not-applicable";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { BUSINESS_PLAN_SECTIONS } from "@/lib/business-plan/sections";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFounderMilestones } from "@/lib/data/founder-milestones";
import { loadOutreachStatus } from "@/lib/founder/outreach-status";
import { naSummaryNote } from "@/lib/documents/na-shared";
import { businessPlanCoreProgress } from "@/lib/business-plan/completion";

export type StepState = "done" | "in_progress" | "not_started" | "unknown";
export interface StepPart {
  key: string;
  label: string;
  desc: string;
  done: boolean;
}
export interface StepProgress {
  percent: number | null;
  state: StepState;
  /** First time this step was seen done (ISO), from founder_stage_step_progress. */
  completedAt?: string | null;
  /** Sub-parts that together make the step (Outreach: automated + manual). */
  parts?: StepPart[];
  /** Short status chip text overriding the percentage (e.g. "1 of 2 done"). */
  badge?: string;
  /** Shown under the step, e.g. "1 item marked N/A: Customer contracts". N/A counts as done. */
  note?: string;
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
    const notApplicableCodes = await loadNotApplicableTypes(createServiceRoleClient(), company.id).catch(() => [] as string[]);
    const checklist = buildDocumentChecklist(documents, undefined, notApplicableCodes);
    // N/A counts as done: it fills its slot like an upload, and the step says so.
    const naItems = checklist.filter((c) => c.status === "not_applicable");
    const doneCount = checklist.filter((c) => c.status === "uploaded" || c.status === "needs_review" || c.status === "not_applicable").length;
    const docsPercent = checklist.length ? (doneCount / checklist.length) * 100 : 0;
    const docsNote = naSummaryNote(naItems.map((c) => c.label));
    const hasDoc = (label: string) =>
      checklist.some((c) => c.label === label && (c.status === "uploaded" || c.status === "needs_review"));
    const isNaDoc = (label: string) => checklist.some((c) => c.label === label && c.status === "not_applicable");

    const profilePercent = buildProfileCompletion(company).percent;

    const planProgress = businessPlanCoreProgress(plan, BUSINESS_PLAN_SECTIONS);

    const diligenceReport = (reportRes as { data?: { readiness_score?: number | null } | null } | null)?.data ?? null;
    const hasReport = Boolean(diligenceReport);

    // Capital Readiness Rating step: reflect the founder's actual readiness (the
    // diligence report's score, or the N/A-aware checklist estimate) as progress
    // toward the institutional target, instead of a binary total_score check that
    // this flow never writes. Done once readiness clears the target.
    const uploadedTypeCodes = documents.flatMap((d) => (d.document_type ? [d.document_type] : []));
    // The CRR engine score — one number across the platform. The old expression
    // survives only as a last resort for a company the engine has never scored.
    const readiness = (await crrScoresFor([company.id])).get(company.id)
      ?? diligenceReport?.readiness_score ?? computeReadinessScore(uploadedTypeCodes, undefined, notApplicableCodes);
    // Done at the engine's own gate, not a target typed on this page — 80 was a
    // third threshold competing with the gate of 65 and the checklist's 75.
    const readinessStep = readiness >= OUTREACH_GATE ? step(100) : step(readiness);

    if (slug === "onboarding") {
      return rollup({
        "/founder/settings": step(profilePercent),
        "/founder/preview": step(profilePercent),
      });
    }
    return rollup({
      // Keyed on the step's own href — the rating step links to the rating.
      "/founder/readiness": readinessStep,
      "/founder/business-plan": { ...step(planProgress.percent), note: naSummaryNote(planProgress.naTitles, "section") },
      "/founder/pitch-deck": hasDoc("Pitch deck")
        ? step(100)
        : isNaDoc("Pitch deck")
          ? { ...step(100), note: naSummaryNote(["Pitch deck"]) }
          : step(0),
      "/founder/readiness/data-room": { ...step(docsPercent), note: docsNote },
      "/founder/report": step(hasReport ? 100 : 0),
    });
  }

  if (slug === "marketing") {
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    const [outreach, hasIntro, hasInterest, hasSaved, hasApplication] = await Promise.all([
      loadOutreachStatus(company.id),
      hasRow(admin, "intro_requests", { company_id: company.id }),
      hasRow(admin, "investor_interests", { company_id: company.id }),
      hasRow(admin, "saved_deals", { company_id: company.id }),
      hasRow(admin, "speaker_applications", { applicant_id: profileId }),
    ]);
    const inPipeline = hasIntro || hasInterest || hasSaved;
    // Outreach is done only when both modes are used: automated launched AND
    // the first manual email sent. Each half is worth 50%.
    const outreachDone = [outreach.automated.launched, outreach.manual.started].filter(Boolean).length;
    const outreachStep: StepProgress = {
      ...step(outreachDone * 50),
      badge: `${outreachDone} of 2 done`,
      parts: [
        {
          key: "automated",
          label: "Automated",
          desc: "AI intros to platform matches. You approve each send.",
          done: outreach.automated.launched,
        },
        {
          key: "manual",
          label: "Manual",
          desc: "Email investors you already know from your contacts.",
          done: outreach.manual.started,
        },
      ],
    };
    return rollup({
      "/founder/deploy": outreachStep,
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
