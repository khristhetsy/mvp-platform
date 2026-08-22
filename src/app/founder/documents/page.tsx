import Link from "next/link";
import { DocumentQualityPanel } from "@/components/founder/DocumentQualityPanel";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { listCompanyDocuments } from "@/lib/data/documents";
import { loadNotApplicableTypes } from "@/lib/documents/not-applicable";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import { getUploadLimits } from "@/lib/settings/platform-settings";

// Human-readable label lookup — covers canonical codes + upload-API aliases
const DOC_TYPE_LABEL_MAP: Record<string, string> = {};
const _FOUNDER_DOCUMENT_TYPES_RAW: { label: string; value: string; aliases?: string[] }[] = [
  { label: "Pitch Deck", value: "PITCH_DECK" },
  { label: "Business Plan", value: "BUSINESS_PLAN" },
  { label: "Financials", value: "FINANCIALS", aliases: ["FINANCIAL_STATEMENTS"] },
  { label: "Cap Table", value: "CAP_TABLE" },
  { label: "Team Bios", value: "TEAM_BIOS" },
  { label: "Legal Document", value: "LEGAL_DOCUMENT", aliases: ["LEGAL_DOCUMENTS"] },
  { label: "Corporate Documents", value: "CORPORATE_DOCUMENTS" },
  { label: "Customer Contracts", value: "CUSTOMER_CONTRACTS" },
  { label: "Market Research", value: "MARKET_RESEARCH" },
  { label: "Other", value: "OTHER" },
];

// Build the lookup map now that the array is fully defined
for (const t of _FOUNDER_DOCUMENT_TYPES_RAW) {
  DOC_TYPE_LABEL_MAP[t.value.toUpperCase()] = t.label;
  for (const alias of t.aliases ?? []) {
    DOC_TYPE_LABEL_MAP[alias.toUpperCase()] = t.label;
  }
}

const FOUNDER_DOCUMENT_TYPES: { label: string; value: string; aliases?: string[] }[] = _FOUNDER_DOCUMENT_TYPES_RAW;

export default async function DocumentUploadPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const { company } = await getActiveCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: documents } = company ? await listCompanyDocuments(supabase, company.id) : { data: [] };
  const notApplicableTypes = company
    ? await loadNotApplicableTypes(createServiceRoleClient(), company.id)
    : [];
  const uploadLimits = await getUploadLimits();
  const maxUploadBytes = uploadLimits.maxMb * 1024 * 1024;

  const existingByType: Record<string, { fileName?: string | null } | undefined> = {};
  for (const type of FOUNDER_DOCUMENT_TYPES) {
    const matchValues = new Set([type.value, ...(type.aliases ?? [])].map((v) => v.toUpperCase()));
    const latest =
      (documents ?? []).find(
        (doc) =>
          doc.document_type &&
          matchValues.has(String(doc.document_type).toUpperCase()) &&
          String(doc.status ?? "").toLowerCase() !== "archived",
      ) ?? null;
    if (latest) {
      existingByType[type.value.toUpperCase()] = { fileName: latest.file_name ?? null };
    }
  }

  const debugEnabled = process.env.NODE_ENV !== "production";
  const membership =
    debugEnabled && company
      ? await supabase
          .from("company_members")
          .select("role")
          .eq("company_id", company.id)
          .eq("user_id", authUser?.id ?? profile.id)
          .maybeSingle()
      : null;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="documents">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("documents")}
            title={t("upload_diligence_documents")}
            description={t("files_are_stored_in_a_private_bucket_and_serve")}
          />
        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="cap-surface-card p-4 sm:p-6">

          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-[var(--blue-hover)]"><i className="ti ti-paperclip" aria-hidden="true" /></span>
              <p className="text-sm font-semibold text-slate-900">Accepted file types</p>
            </div>
            <p className="mt-1.5 text-[13px] leading-6 text-slate-600">
              Upload PDF, Word, Excel, or CSV files, up to 25&nbsp;MB each. For the AI diligence report to read a
              document, use one of these formats:{" "}
              <span className="font-medium text-slate-800">PDF (.pdf)</span>,{" "}
              <span className="font-medium text-slate-800">Word (.docx)</span>,{" "}
              <span className="font-medium text-slate-800">Excel (.xlsx, .xls)</span>, or{" "}
              <span className="font-medium text-slate-800">CSV (.csv)</span>.
            </p>
            <ul className="mt-2.5 space-y-1.5 text-[12.5px] leading-5 text-slate-600">
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="text-slate-400">•</span>
                The <span className="font-medium text-slate-800">pitch deck must be a PDF</span>.
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="text-amber-600">•</span>
                Old <span className="font-medium text-slate-800">.doc</span> files upload but can&apos;t be analyzed — save as{" "}
                <span className="font-medium text-slate-800">.docx</span> first.
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="text-amber-600">•</span>
                Scanned or image-only PDFs have no readable text — upload a text-based PDF so the report can read it.
              </li>
            </ul>
          </div>

          {!company ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              <p className="font-semibold">{t("no_company_profile_is_linked_to_your_account")}</p>
              <p className="mt-2">{t("please_create_a_company_profile_first_then_ret")}</p>
              <Link
                href="/founder/onboarding"
                className="cap-btn-primary mt-4 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold"
              >
                Create company profile
              </Link>
            </div>
          ) : (
            <DocumentUploadForm
              companyId={company.id}
              companyName={company.company_name}
              documentTypes={FOUNDER_DOCUMENT_TYPES.map(({ label, value }) => ({ label, value }))}
              existingByType={existingByType}
              notApplicableTypes={notApplicableTypes}
              maxUploadBytes={maxUploadBytes}
              maxPages={uploadLimits.maxPages}
            />
          )}

          {debugEnabled ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">{t("dev_diagnostics_temporary")}</p>
              <pre className="mt-2 whitespace-pre-wrap">
{JSON.stringify(
  {
    authUserId: authUser?.id ?? null,
    profileId: profile.id,
    companyId: company?.id ?? null,
    companyName: company?.company_name ?? null,
    companyMembersRole: membership?.data?.role ?? null,
  },
  null,
  2,
)}
              </pre>
              <p className="mt-2 text-slate-500">
                Tip: to get server upload debug, call upload with <span className="font-mono">/api/documents/upload?debug=1</span>.
              </p>
            </div>
          ) : null}
        </div>

        {company ? (
        <div className="space-y-5">
          {/* Document quality analyzer */}
          <DocumentQualityPanel documents={documents ?? []} notApplicableTypes={notApplicableTypes} />

          {/* Uploaded files list */}
          <div className="cap-surface-card p-4 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">{t("uploaded_files")}</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(documents ?? []).length > 0 ? (
                documents?.map((document) => {
                  const typeLabel = document.document_type
                    ? (DOC_TYPE_LABEL_MAP[document.document_type.toUpperCase()] ?? document.document_type)
                    : null;
                  return (
                    <div key={document.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800">{document.file_name ?? document.document_type}</p>
                        {typeLabel && (
                          <p className="text-xs text-slate-400">{typeLabel}</p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--blue-muted)] px-3 py-1 text-xs font-medium text-[var(--blue-hover)]">{document.status ?? "uploaded"}</span>
                    </div>
                  );
                })
              ) : (
                <p className="py-3 text-sm text-slate-600">{t("no_documents_uploaded_yet")}</p>
              )}
            </div>
            <Link href="/founder/report" className="cap-btn-secondary mt-5 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold">
              Generate diligence report
            </Link>
          </div>
        </div>
        ) : null}
      </section>
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
