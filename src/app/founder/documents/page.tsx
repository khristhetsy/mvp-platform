import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { listCompanyDocuments } from "@/lib/data/documents";
import { requiredDocumentTypes } from "@/lib/mock-data";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export default async function DocumentUploadPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const { data: documents } = company ? await listCompanyDocuments(supabase, company.id) : { data: [] };
  const maxUploadBytes = 25 * 1024 * 1024;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="documents">
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="cap-module-card p-6 lg:p-8">
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
              documentTypes={requiredDocumentTypes}
              maxUploadBytes={maxUploadBytes}
            />
          )}
        </div>

        <div className="cap-module-card p-6 lg:p-8">
          <h2 className="text-lg font-semibold text-slate-950">Uploaded files</h2>
          <div className="mt-5 divide-y divide-slate-100">
            {(documents ?? []).length > 0 ? (
              documents?.map((document) => (
                <div key={document.id} className="flex items-center justify-between py-4 text-sm">
                  <span className="font-medium text-slate-800">{document.file_name ?? document.document_type}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{document.status ?? "uploaded"}</span>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-slate-600">No documents uploaded yet.</p>
            )}
          </div>
          <Link href="/founder/report" className="mt-6 inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
            Generate diligence report
          </Link>
        </div>
      </section>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
