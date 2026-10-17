import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { requireRole } from "@/lib/supabase/auth";
import { loadContactDetail } from "@/lib/founder-crm/contact-detail";
import { loadVocabularies } from "@/lib/vocabulary/store";
import { offered } from "@/lib/vocabulary/lists";
import { ContactDetailClient } from "./ContactDetailClient";

export const dynamic = "force-dynamic";

export default async function FounderContactPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  const detail = company ? await loadContactDetail(company.id, profile.id, id) : null;
  if (company && !detail) notFound();

  // The same option lists the rest of iCapOS uses (investor type, funding stage,
  // industry). Stored values are labels, as the directory import writes them.
  const vocab = await loadVocabularies();
  const options = {
    investorTypes: offered(vocab.investor_type).map((o) => o.label),
    stages: offered(vocab.funding_stage).map((o) => o.label),
    sectors: offered(vocab.industry).map((o) => o.label),
    geography: offered(vocab.geography).map((o) => o.label),
    operatingStages: offered(vocab.operating_stage).map((o) => o.label),
    useOfFunds: offered(vocab.use_of_funds).map((o) => o.label),
    moneyBands: offered(vocab.money_band).map((o) => o.label),
    revenueBands: offered(vocab.revenue_size).map((o) => o.label),
    arrBands: offered(vocab.arr_band).map((o) => o.label),
    mrrBands: offered(vocab.mrr_band).map((o) => o.label),
  };

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderJourneyGate minStage="deploy">
        <FounderFeatureGate featureKey="investor_access">
          <WorkspacePageContainer>
            {detail ? (
              <ContactDetailClient
                initialContact={detail.contact}
                pager={detail.pager}
                engagement={detail.engagement}
                options={options}
              />
            ) : (
              <DealCompanyEmptyState />
            )}
          </WorkspacePageContainer>
        </FounderFeatureGate>
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
