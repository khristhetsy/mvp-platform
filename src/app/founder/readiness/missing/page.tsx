import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listCompanyDocuments } from "@/lib/data/documents";
import { buildDocumentChecklist, getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderReadinessMissingPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const documents = company ? (await listCompanyDocuments(supabase, company.id)).data ?? [] : [];
  const checklist = buildDocumentChecklist(documents);
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
            eyebrow="Readiness"
            title="Missing documents"
            description="Documents still needed to complete your readiness checklist."
          />

          {!company ? (
            <WorkspacePanel title="Company profile required" subtitle="Complete setup to view missing documents">
              <p className="text-sm text-slate-600">Create your company profile to track missing documents.</p>
            </WorkspacePanel>
          ) : (
            <WorkspacePanel
              title="Missing key documents"
              subtitle={`${missingDocuments.length} item${missingDocuments.length !== 1 ? "s" : ""} missing`}
            >
              {missingDocuments.length === 0 ? (
                <p className="text-sm text-emerald-700">All key documents are uploaded.</p>
              ) : (
                <ul className="grid gap-2 text-sm text-slate-700">
                  {missingDocuments.map((item) => {
                    const label = item.label.toLowerCase();
                    const isBusinessPlan = label === "business plan" || item.code === "BUSINESS_PLAN";
                    const isFinancialModel =
                      label === "financial model" || item.code === "FINANCIAL_MODEL" || item.code === "FINANCIAL_STATEMENTS";
                    const cta = isBusinessPlan
                      ? { href: "/founder/business-plan", text: "Don't have one? Generate it with AI →" }
                      : isFinancialModel
                        ? { href: "/founder/financial-model", text: "Build it here with our model →" }
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
                  <p className="text-sm font-semibold text-amber-950">AI report flagged missing items</p>
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
