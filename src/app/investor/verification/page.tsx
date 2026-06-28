import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { InvestorKycClient, type KycItemView } from "@/components/investor/InvestorKycClient";
import { InvestorDealsManager, type DealView } from "@/components/investor/InvestorDealsManager";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { getInvestorProfileByProfileId } from "@/lib/investor/profile";
import { computeKycChecklistState, createKycSignedUrl, listKycDocuments } from "@/lib/investor/kyc";
import { listPriorDeals } from "@/lib/investor/prior-deals";

export const dynamic = "force-dynamic";

export default async function InvestorVerificationPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const investorProfile = await getInvestorProfileByProfileId(profile.id);

  // Stage 2 only opens once the profile (Stage 1) is approved.
  if (!investorProfile || investorProfile.approval_status !== "approved") {
    redirect("/investor/dashboard");
  }

  const documents = await listKycDocuments(investorProfile.id);
  const state = computeKycChecklistState(investorProfile.investor_type, documents);

  const priorDeals = await listPriorDeals(investorProfile.id);
  const dealViews: DealView[] = priorDeals.map((d) => ({
    id: d.id,
    companyName: d.company_name,
    stage: d.stage,
    year: d.year,
    amount: d.amount,
    verified: d.verified,
    hasProof: d.proof_document_id != null,
  }));

  const items: KycItemView[] = await Promise.all(
    state.items.map(async (item) => {
      let signedUrl: string | null = null;
      if (item.document) {
        const { data } = await createKycSignedUrl(item.document.file_path);
        signedUrl = data?.signedUrl ?? null;
      }
      return {
        code: item.code,
        label: item.label,
        description: item.description,
        required: item.required,
        uploaded: item.uploaded,
        fileName: item.document?.file_name ?? null,
        signedUrl,
      };
    }),
  );

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Verification"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Stage 2 · Verification"
          title="Identity & accreditation"
          description="Verify who you are and that you qualify to invest. This is reviewed by the iCapOS team and unlocks full deal-flow access."
        />
        <div className="max-w-2xl">
          <InvestorKycClient
            kycStatus={investorProfile.kyc_status}
            kycFeedback={investorProfile.kyc_feedback}
            items={items}
            canSubmit={state.canSubmit}
            legalName={investorProfile.legal_name}
            kycConsent={investorProfile.kyc_consent}
          />

          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-900">Your deals <span className="text-[12px] font-normal text-slate-400">· optional, boosts your score</span></p>
            <p className="mt-1 mb-3 text-[13px] leading-6 text-slate-500">
              Add a few prior investments and attach proof. Verified deals strengthen your Partner Score and can show on your profile.
            </p>
            <InvestorDealsManager deals={dealViews} showTrackRecord={investorProfile.show_track_record} />
          </div>
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
