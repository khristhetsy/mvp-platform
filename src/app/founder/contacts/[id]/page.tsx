import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { requireRole } from "@/lib/supabase/auth";
import { loadContactDetail } from "@/lib/founder-crm/contact-detail";
import { loadContactNotes, loadContactTasks } from "@/lib/founder-crm/contact-notes";
import { contactHasSentEmail } from "@/lib/founder-crm/contact-delete";
import { getManualOutreach } from "@/lib/outreach/manual-outreach";
import { loadVocabularies } from "@/lib/vocabulary/store";
import { offered } from "@/lib/vocabulary/lists";
import { ContactDetailClient } from "./ContactDetailClient";

export const dynamic = "force-dynamic";

const TAB_IDS = ["email", "note", "profile", "tasks", "activity"] as const;

export default async function FounderContactPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }>) {
  const { id } = await params;
  // The clock menu opens a task's contact with ?tab=tasks.
  const { tab } = await searchParams;
  const initialTab = (TAB_IDS as readonly string[]).includes(tab ?? "") ? (tab as (typeof TAB_IDS)[number]) : "profile";
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  const detail = company ? await loadContactDetail(company.id, profile.id, id) : null;
  if (company && !detail) notFound();

  // Note log and Tasks for this contact. Both are private to this founder.
  const [notes, tasks] = detail
    ? await Promise.all([loadContactNotes(profile.id, id), loadContactTasks(profile.id, id)])
    : [[], []];

  // Delete is offered only when no email has gone to this contact.
  const canDelete = detail && company ? !(await contactHasSentEmail(company.id, id, detail.contact.email)) : false;

  // The saved Manual outreach email, shown on the Send email tab (this page sends that email).
  const campaign = company ? await getManualOutreach(company.id).catch(() => null) : null;
  const email = {
    subject: campaign?.emailSubject ?? "",
    body: campaign?.emailBody ?? "",
    ready: Boolean(campaign?.emailSubject?.trim() && campaign?.emailBody?.trim() && (campaign?.sequence?.length ?? 0) > 0),
    companyName: company?.company_name ?? "",
    sector: (company as { industry?: string | null } | null)?.industry ?? "",
  };

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
                email={email}
                notes={notes}
                tasks={tasks}
                initialTab={initialTab}
                canDelete={canDelete}
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
