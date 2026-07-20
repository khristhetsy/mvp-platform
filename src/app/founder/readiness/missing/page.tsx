import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listCompanyDocuments } from "@/lib/data/documents";
import { buildDocumentChecklist, getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { loadNotApplicableTypes } from "@/lib/documents/not-applicable";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderReadinessMissingPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const documents = company ? (await listCompanyDocuments(supabase, company.id)).data ?? [] : [];
  const notApplicable = company
    ? await loadNotApplicableTypes(createServiceRoleClient(), company.id)
    : [];
  const checklist = buildDocumentChecklist(documents, undefined, notApplicable);
  // Types the founder marked N/A are never "missing".
  const missingDocuments = checklist.filter((item) => item.status === "missing");

  const { data: diligenceReport } = company
    ? await getLatestDiligenceReport(supabase, company.id)
    : { data: null };

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="readiness">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("readiness")}
            title={t("missing_documents")}
            description={t("documents_still_needed_to_complete_your_readin")}
          />

          {!company ? (
            <WorkspacePanel title={t("company_profile_required")} subtitle={t("complete_setup_to_view_missing_documents")}>
              <p className="text-sm text-slate-600">{t("create_your_company_profile_to_track_missing_d")}</p>
            </WorkspacePanel>
          ) : (
            <WorkspacePanel
              title={t("missing_key_documents")}
              subtitle={`${missingDocuments.length} item${missingDocuments.length !== 1 ? "s" : ""} missing`}
            >
              {missingDocuments.length === 0 ? (
                <p className="text-sm text-emerald-700">{t("all_key_documents_are_uploaded")}</p>
              ) : (
                <ul className="grid gap-2 text-sm text-slate-700">
                  {missingDocuments.map((item) => {
                    const label = item.label.toLowerCase();
                    const isBusinessPlan = label === "business plan" || item.code === "BUSINESS_PLAN";
                    const isFinancialModel =
                      label === "financial model" || item.code === "FINANCIAL_MODEL" || item.code === "FINANCIAL_STATEMENTS";
                    const isCapTable = label === "cap table" || item.code === "CAP_TABLE";
                    const cta = isBusinessPlan
                      ? { href: "/founder/business-plan", text: "Don't have one? Generate it with AI →" }
                      : isFinancialModel
                        ? { href: "/founder/financial-model", text: "Build it here with our model →" }
                        : isCapTable
                          ? { href: "/founder/cap-table", text: "Build it here →" }
                          : null;
                    return (
                      <li
                        key={item.code}
                        className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <span>{item.label}</span>
                        {cta ? (
                          <Link
                            href={cta.href}
                            className="inline-flex flex-none items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            {cta.text}
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {Array.isArray(diligenceReport?.missing_documents) &&
              (diligenceReport.missing_documents as string[]).length > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-950">{t("ai_report_flagged_missing_items")}</p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-900">
                    {(diligenceReport.missing_documents as string[]).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </WorkspacePanel>
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
