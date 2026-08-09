import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getStageGuide } from "@/lib/founder/stage-guides";
import { computeStageProgress } from "@/lib/founder/stage-progress";
import { StageGuideView } from "@/components/founder/StageGuide";

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
  const supabase = await createServerSupabaseClient();
  const progress = await computeStageProgress(supabase, company, stage, profile.id);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
        <StageGuideView guide={guide} progress={progress} />
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
