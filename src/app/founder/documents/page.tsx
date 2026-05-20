import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requiredDocumentTypes, sampleDocuments } from "@/lib/mock-data";

export default function DocumentUploadPage() {
  return (
    <AppShell role="FOUNDER">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Secure upload</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Upload diligence documents</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Files should be stored in a private bucket and served through signed, role-checked URLs only.
          </p>
          <form action="/api/documents/upload" method="post" encType="multipart/form-data" className="mt-8 grid gap-4">
            <input type="hidden" name="companyId" value="company-nova-analytics" />
            <select name="documentType" className="rounded-xl border border-slate-300 px-4 py-3">
              {requiredDocumentTypes.map((documentType) => (
                <option key={documentType} value={documentType.toUpperCase().replaceAll(" ", "_")}>
                  {documentType}
                </option>
              ))}
            </select>
            <input
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
              className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-sm"
            />
            <button className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white" type="submit">
              Upload document
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Checklist</h2>
          <div className="mt-5 divide-y divide-slate-100">
            {sampleDocuments.map((document) => (
              <div key={document.type} className="flex items-center justify-between py-4 text-sm">
                <span className="font-medium text-slate-800">{document.name}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{document.status}</span>
              </div>
            ))}
          </div>
          <Link href="/founder/report" className="mt-6 inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
            Generate diligence report
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
