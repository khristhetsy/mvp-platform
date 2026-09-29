import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import {
  buildDocumentChecklist,
  buildProfileCompletion,
  computeReadinessScore,
  getLatestDiligenceReport,
} from "@/lib/data/founder-readiness";
import { listCompanyDocuments } from "@/lib/data/documents";
import { loadNotApplicableTypes } from "@/lib/documents/not-applicable";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  ReadinessWizard,
  type WizardDoc,
  type WizardProfileItem,
} from "@/components/founder/ReadinessWizard";
import { CrrImprovement } from "@/components/founder/CrrImprovement";
import { crrFor } from "@/lib/crr/crr-for";
import { improvementSteps, reachesGate } from "@/lib/crr/improvement";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { resolveActingFounderScope } from "@/lib/admin/act-on-behalf";

export const dynamic = "force-dynamic";

const PROFILE_HINTS: Record<string, { hint: string; href: string }> = {
  company_name: { hint: "Your company name is the first thing investors see.", href: "/founder/settings" },
  industry: { hint: "Industry helps investors filter by their focus area — without it you won't appear in their searches.", href: "/founder/settings" },
  business_description: { hint: "A clear 2–3 sentence description of what you do and for whom. Aim for 50+ words.", href: "/founder/settings" },
  funding_amount: { hint: "How much you're raising in this round. Required for interest and match calculations.", href: "/founder/settings" },
  use_of_funds: { hint: "Investors always ask: 'What will you do with the money?' Answer it in your profile.", href: "/founder/settings" },
  revenue_stage: { hint: "Pre-revenue, seed, growth — this unlocks stage-appropriate investor matches.", href: "/founder/settings" },
  team_summary: { hint: "A brief description of your founding team. Investors invest in people first.", href: "/founder/settings" },
};

export default async function ReadinessWizardPage() {
  // Act-on-behalf: permissioned staff render as the founder; otherwise normal gate.
  const acting = await resolveActingFounderScope();
  const profile = acting ? acting.profile : await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = acting ? acting.company : (await getActiveCompanyForUser(profile)).company;

  // Deal Company (no active company) has no readiness to improve — show a single empty state.
  if (!company) {
    return (
      <FounderAppShell
        profileName={profile.full_name ?? profile.email ?? "Founder"}
        profileSubtitle="No active raise"
      >
        <div className="mx-auto max-w-2xl space-y-6">
          <PageHeader
            eyebrow={t("readiness")}
            title={t("score_improvement_wizard")}
            description={t("complete_each_step_to_reach_80_and_unlock_inst")}
          />
          <DealCompanyEmptyState />
        </div>
      </FounderAppShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  // Founder-scoped reads go through the acting client when staff are acting on
  // behalf; otherwise the staff session hits RLS and the page renders empty.
  const db = acting ? acting.supabase : supabase;

  const documents = company ? (await listCompanyDocuments(db, company.id)).data ?? [] : [];
  // Documents the founder marked "not applicable" (e.g. a SaaS with no customer
  // contracts) — excluded from the gap list and the score so they aren't nagged
  // to upload something that doesn't apply.
  const notApplicableCodes = company
    ? await loadNotApplicableTypes(createServiceRoleClient(), company.id).catch(() => [] as string[])
    : [];
  const checklist = buildDocumentChecklist(documents, undefined, notApplicableCodes);
  const profileCompletion = buildProfileCompletion(company);

  const { data: diligenceReport } = company
    ? await getLatestDiligenceReport(db, company.id)
    : { data: null };

  // The rating itself — what the gate reads, and what this page is now about.
  const crr = await crrFor(company.id);
  const steps = improvementSteps(crr.factorGaps);
  const reach = reachesGate(steps, crr.pointsToGate);

  const uploadedTypeCodes = documents.flatMap((d) => (d.document_type ? [d.document_type] : []));
  const currentScore = diligenceReport?.readiness_score ?? computeReadinessScore(uploadedTypeCodes, undefined, notApplicableCodes);
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
            description={
              crr.score === null
                ? "Run your Capital Readiness Rating to see what to work on."
                : crr.outreachUnlocked
                  ? `Your CRR is ${crr.score}. Outreach is open — these still raise it.`
                  : `Your CRR is ${crr.score}. Outreach unlocks at ${crr.gate}.`
            }
          />

          <CrrImprovement
            companyName={company?.company_name ?? "Your company"}
            score={crr.score}
            band={crr.band}
            gate={crr.gate}
            pointsToGate={crr.pointsToGate}
            outreachUnlocked={crr.outreachUnlocked}
            dimensions={crr.dimensions.map((d) => ({
              label: d.label, contributes: d.contributes, weight: d.weight,
            }))}
            steps={steps}
            reach={reach}
            scoredAt={crr.scoredAt}
          />

          <div>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              Document checklist
            </h2>
            <p className="mb-2 text-[11.5px] text-[var(--text-muted)]">
              What is still missing from your data room. These feed the rating above rather than scoring separately.
            </p>
          </div>
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
