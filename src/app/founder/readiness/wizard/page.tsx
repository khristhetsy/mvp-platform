import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import {
  buildDocumentChecklist,
  buildProfileCompletion,
  computeReadinessScore,
  getLatestDiligenceReport,
} from "@/lib/data/founder-readiness";
import { listCompanyDocuments } from "@/lib/data/documents";
import {
  ReadinessWizard,
  type WizardDoc,
  type WizardProfileItem,
} from "@/components/founder/ReadinessWizard";

export const dynamic = "force-dynamic";

const PROFILE_HINTS: Record<string, { hint: string; href: string }> = {
  company_name: { hint: "Your company name is the first thing investors see.", href: "/founder/settings" },
  industry: { hint: "Industry helps investors filter by their focus area — without it you won't appear in their searches.", href: "/founder/settings" },
  business_description: { hint: "A clear 2–3 sentence description of what you do and for whom. Aim for 50+ words.", href: "/founder/settings" },
  funding_amount: { hint: "How much you're raising in this round. Required for pledge and match calculations.", href: "/founder/settings" },
  use_of_funds: { hint: "Investors always ask: 'What will you do with the money?' Answer it in your profile.", href: "/founder/settings" },
  revenue_stage: { hint: "Pre-revenue, seed, growth — this unlocks stage-appropriate investor matches.", href: "/founder/settings" },
  team_summary: { hint: "A brief description of your founding team. Investors invest in people first.", href: "/founder/settings" },
};

export default async function ReadinessWizardPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const documents = company ? (await listCompanyDocuments(supabase, company.id)).data ?? [] : [];
  const checklist = buildDocumentChecklist(documents);
  const profileCompletion = buildProfileCompletion(company);

  const { data: diligenceReport } = company
    ? await getLatestDiligenceReport(supabase, company.id)
    : { data: null };

  const uploadedTypeCodes = documents.flatMap((d) => (d.document_type ? [d.document_type] : []));
  const currentScore = diligenceReport?.readiness_score ?? computeReadinessScore(uploadedTypeCodes);
  const targetScore = 80;

  const missingDocs: WizardDoc[] = checklist
    .filter((item) => item.status === "missing")
    .map((item) => ({ label: item.label, code: item.code, uploaded: false }));

  const incompleteProfile: WizardProfileItem[] = profileCompletion.items
    .filter((item) => !item.complete)
    .map((item) => {
      const field = item.label.toLowerCase().replaceAll(" ", "_");
      const meta = PROFILE_HINTS[field] ?? { hint: `Complete your ${item.label.toLowerCase()} in company settings.`, href: "/founder/settings" };
      return {
        label: item.label,
        field,
        complete: false,
        hint: meta.hint,
        href: meta.href,
      };
    });

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="readiness">
        <div className="mx-auto max-w-2xl space-y-6">
          <PageHeader
            eyebrow={t("readiness")}
            title={t("score_improvement_wizard")}
            description={t("complete_each_step_to_reach_80_and_unlock_inst")}
          />
          <ReadinessWizard
            currentScore={currentScore}
            targetScore={targetScore}
            missingDocs={missingDocs}
            incompleteProfile={incompleteProfile}
            companyName={company?.company_name ?? "Your company"}
          />
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
