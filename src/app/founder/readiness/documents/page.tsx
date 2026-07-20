import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listCompanyDocuments } from "@/lib/data/documents";
import { buildDocumentChecklist } from "@/lib/data/founder-readiness";
import { loadNotApplicableTypes } from "@/lib/documents/not-applicable";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type ChecklistStatus = "missing" | "uploaded" | "needs_review" | "not_applicable";

function checklistStatusLabel(status: ChecklistStatus) {
  switch (status) {
    case "uploaded":
      return "Uploaded";
    case "needs_review":
      return "Needs review";
    case "not_applicable":
      return "Not applicable";
    default:
      return "Missing";
  }
}

function checklistStatusClass(status: ChecklistStatus) {
  switch (status) {
    case "uploaded":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "needs_review":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    case "not_applicable":
      return "bg-slate-50 text-slate-400 ring-slate-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-100";
  }
}

export default async function FounderReadinessDocumentsPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();

  const documents = company ? (await listCompanyDocuments(supabase, company.id)).data ?? [] : [];
  const notApplicable = company
    ? await loadNotApplicableTypes(createServiceRoleClient(), company.id)
    : [];
  const checklist = buildDocumentChecklist(documents, undefined, notApplicable);
  // N/A items are excluded from both sides of the ratio — they're not missing
  // and they don't count toward what's required.
  const applicable = checklist.filter((item) => item.status !== "not_applicable");
  const uploadedCount = applicable.filter((item) => item.status !== "missing").length;
  const naCount = checklist.length - applicable.length;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="readiness">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("readiness")}
            title={t("document_checklist")}
            description={t("required_diligence_documents_and_upload_status")}
          />

          {!company ? (
            <WorkspacePanel title={t("company_profile_required")} subtitle={t("complete_setup_to_view_document_checklist")}>
              <p className="text-sm text-slate-600">{t("create_your_company_profile_to_track_document")}</p>
            </WorkspacePanel>
          ) : (
            <WorkspacePanel
              title={t("document_checklist")}
              subtitle={`${uploadedCount} of ${applicable.length} uploaded${naCount > 0 ? ` · ${naCount} N/A` : ""}`}
              action={
                <Link
                  href="/founder/documents"
                  className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                >
                  Manage uploads
                </Link>
              }
            >
              <div className="divide-y divide-slate-100">
                {checklist.map((item) => (
                  <div key={item.code} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{item.label}</p>
                      {item.fileName ? <p className="mt-0.5 text-xs text-slate-500">{item.fileName}</p> : null}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${checklistStatusClass(item.status)}`}
                    >
                      {checklistStatusLabel(item.status)}
                    </span>
                  </div>
                ))}
              </div>
            </WorkspacePanel>
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
