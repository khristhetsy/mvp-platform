import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { listCompanyDocuments } from "@/lib/data/documents";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

const FOUNDER_DOCUMENT_TYPES: { label: string; value: string; aliases?: string[] }[] = [
  { label: "Pitch Deck", value: "PITCH_DECK" },
  { label: "Business Plan", value: "BUSINESS_PLAN" },
  { label: "Financials", value: "FINANCIALS", aliases: ["FINANCIAL_STATEMENTS"] },
  { label: "Cap Table", value: "CAP_TABLE" },
  { label: "Team Bios", value: "TEAM_BIOS" },
  { label: "Legal Document", value: "LEGAL_DOCUMENT", aliases: ["LEGAL_DOCUMENTS"] },
  { label: "Other", value: "OTHER" },
];

export default async function DocumentUploadPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: documents } = company ? await listCompanyDocuments(supabase, company.id) : { data: [] };
  const maxUploadBytes = 25 * 1024 * 1024;

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
        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="cap-surface-card p-6 lg:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">Secure upload</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--navy)]">Upload diligence documents</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Files are stored in a private Supabase bucket and served through signed, role-checked URLs only.
          </p>

          {!company ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              <p className="font-semibold">No company profile is linked to your account.</p>
              <p className="mt-2">Please create a company profile first, then return here to upload your pitch deck.</p>
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
              maxUploadBytes={maxUploadBytes}
            />
          )}

          {debugEnabled ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">Dev diagnostics (temporary)</p>
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

        <div className="cap-surface-card p-6 lg:p-7">
          <h2 className="text-lg font-semibold text-[var(--navy)]">Uploaded files</h2>
          <div className="mt-5 divide-y divide-slate-100">
            {(documents ?? []).length > 0 ? (
              documents?.map((document) => (
                <div key={document.id} className="flex items-center justify-between py-4 text-sm">
                  <span className="font-medium text-slate-800">{document.file_name ?? document.document_type}</span>
                  <span className="rounded-full bg-[var(--navy-muted)] px-3 py-1 text-xs font-medium text-[var(--navy)]">{document.status ?? "uploaded"}</span>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-slate-600">No documents uploaded yet.</p>
            )}
          </div>
          <Link href="/founder/report" className="cap-btn-secondary mt-6 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold">
            Generate diligence report
          </Link>
        </div>
      </section>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
