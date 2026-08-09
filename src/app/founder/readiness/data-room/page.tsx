import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { DataRoomReadinessCard } from "@/components/founder/DataRoomReadinessCard";
import { DataRoomAccessPanel } from "@/components/founder/DataRoomAccessPanel";
import { DataRoomActivityPanel } from "@/components/founder/DataRoomActivityPanel";
import { DataRoomEngagementPanel } from "@/components/founder/DataRoomEngagementPanel";
import { DataRoomQAPanel } from "@/components/founder/DataRoomQAPanel";
import { listDataRoomActivity } from "@/lib/data-room/activity";
import { listDataRoomEngagement } from "@/lib/data-room/engagement";
import { listCompanyQuestions } from "@/lib/data-room/qa";
import { listCompanyDocuments } from "@/lib/data/documents";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data room" };

export default async function FounderDataRoomPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const { company } = await getActiveCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const documents = company ? (await listCompanyDocuments(supabase, company.id)).data ?? [] : [];
  const [activity, engagement, questions] = company
    ? await Promise.all([
        listDataRoomActivity(company.id),
        listDataRoomEngagement(company.id),
        listCompanyQuestions(company.id),
      ])
    : [[], { items: [], totalViews: 0, maxViews: 0, uniqueInvestors: 0 }, []];

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
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <DataRoomAccessPanel />
            <DataRoomActivityPanel items={activity} />
            <DataRoomEngagementPanel engagement={engagement} />
            <DataRoomQAPanel questions={questions} />
          </div>
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
