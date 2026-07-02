import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { DataRoomReadinessCard } from "@/components/founder/DataRoomReadinessCard";
import { listCompanyDocuments } from "@/lib/data/documents";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data room" };

export default async function FounderDataRoomPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const documents = company ? (await listCompanyDocuments(supabase, company.id)).data ?? [] : [];

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="readiness">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("due_diligence")}
            title={t("your_data_room")}
            description={t("everything_investors_and_our_diligence_team_ne")}
          />
          <DataRoomReadinessCard documents={documents} />
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
