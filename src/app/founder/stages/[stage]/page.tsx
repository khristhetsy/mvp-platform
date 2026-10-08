import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getStageGuide, type StageSlug } from "@/lib/founder/stage-guides";
import { computeStageProgress } from "@/lib/founder/stage-progress";
import { getStageGateStatus } from "@/lib/founder/stage-gate-status";
import { crrFor } from "@/lib/crr/crr-for";
import type { CrrSummary } from "@/lib/crr/blocker";
import { StageGuideView } from "@/components/founder/StageGuide";
import { loadOutreachStatus } from "@/lib/founder/outreach-status";
import { applyStepMemory } from "@/lib/founder/stage-step-memory";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { STAGE_SLUGS } from "@/lib/founder/stage-guides";

export const dynamic = "force-dynamic";

export default async function FounderStageGuidePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage } = await params;
  const guide = getStageGuide(stage);
  if (!guide) notFound();

  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);

  // Deal Company (no active company) has no stage progress — show a single empty state.
  if (!company) {
    return (
      <FounderAppShell
        profileName={profile.full_name ?? profile.email ?? "Founder"}
        profileSubtitle="No active raise"
      >
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={guide.stageLabel}
            title={guide.title}
            description={guide.intro}
          />
          <DealCompanyEmptyState />
        </WorkspacePageContainer>
      </FounderAppShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  // The rating, so a cleared Preparation cannot imply outreach is open.
  const engineCrr = company ? await crrFor(company.id).catch(() => null) : null;
  const crrSummary: CrrSummary | null = engineCrr
    ? {
        score: engineCrr.score,
        gate: engineCrr.gate,
        pointsToGate: engineCrr.pointsToGate,
        outreachUnlocked: engineCrr.outreachUnlocked,
        dimensions: engineCrr.dimensions.map((d) => ({
          label: d.label, score: d.score, weight: d.weight, headroom: d.headroom,
        })),
      }
    : null;

  // Outreach status drives the Stage 3 checklist and the manual outreach banner.
  const outreach = guide.slug === "marketing" ? await loadOutreachStatus(company.id) : null;

  const [rawProgress, gate, journey] = await Promise.all([
    computeStageProgress(supabase, company, stage, profile.id),
    getStageGateStatus(supabase, profile.id, guide.slug as StageSlug, crrSummary, outreach).catch(() => undefined),
    evaluateFounderJourney(supabase, profile.id).catch(() => null),
  ]);
  // Completed steps remember when they were done; no-signal steps count once opened.
  const progress = await applyStepMemory(company.id, guide, rawProgress);

  // The manual outreach banner shows only while the founder is in Stage 3 and
  // has not sent a manual email yet.
  const guideIdx = STAGE_SLUGS.indexOf(guide.slug as StageSlug);
  const inThisStage = journey ? journey.stageIndex === guideIdx : false;
  const showManualOutreachBanner = guide.slug === "marketing" && inThisStage && outreach !== null && !outreach.manual.started;
  const nextStageSlug = STAGE_SLUGS[guideIdx + 1] ?? null;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
        <StageGuideView
          guide={guide}
          progress={progress}
          gate={gate}
          stageNumber={guideIdx + 1}
          nextStageSlug={nextStageSlug}
          showManualOutreachBanner={showManualOutreachBanner}
        />
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
